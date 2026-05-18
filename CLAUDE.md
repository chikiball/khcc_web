# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What the project is

**KHCC Web** — a Progressive Web App for **Knock House Chop Chop** (cycling club). Fast-pace road cycling: show up, ride hard, coffee, go home. Replaces WhatsApp + spreadsheets for ride coordination.

Deployed at `https://khcc.nandharu.uk`. Full requirements in `docs/REQUIREMENTS.md`.

## Commands

```bash
npm install               # Node 20+ required
npm run dev               # Next.js dev on :3000
npm run build             # production build
npm run start             # run built app on :3030 (prod port behind nginx)
npm run lint              # ESLint
npm run typecheck         # tsc --noEmit
npm run db:generate       # drizzle-kit: generate migration from schema changes
npm run db:migrate        # drizzle-kit: apply pending migrations
npm run db:push           # push schema directly (dev shortcut, no migration file)
npm run db:studio         # open Drizzle Studio GUI

# One-off scripts (inside the container — docker exec khcc-web node node_modules/tsx/dist/cli.mjs scripts/<name>.ts)
scripts/seed.ts                      # seed 3 sample rides with pace groups
scripts/backfill-route-previews.ts   # generate static map preview images for existing GPX files
scripts/send-test-email.ts <addr>    # test SMTP relay
```

## Architecture

**Stack — fully self-hosted, zero managed dependencies:**
Next.js 15 App Router + TypeScript strict · Tailwind v4 · **Postgres 16 in Docker** · **Drizzle ORM** · **Auth.js v5** (Google OAuth + email credentials) · Leaflet (OSM tiles) · Sharp (image resizing) · Nodemailer (Gmail SMTP relay) · `@ducanh2912/next-pwa`.

No Supabase, no Vercel, no Resend, no third-party identity service beyond Google OAuth at sign-in time.

## Auth flow

Two providers on `/login`:
- **Google** — OAuth, verified email, redirects back through `/api/auth/callback/google`
- **Email credentials** — user types email, no password, no magic link. Server either creates a new user (`status=pending`) or signs in the existing one. If rejected → auto-flip to `pending` on re-sign-in.

After sign-in:
- `onboardedAt` null → `/onboarding`
- `status` pending/rejected → `/pending`
- `status` approved → `/rides`

Session JWT carries `id`, `role`, `status`, `onboarded`, `paceGroup`. Refreshed from DB on every request while `!approved` or `!onboarded` (transient states that need to propagate without re-login). Once approved + onboarded, JWT caches — no per-request DB hit.

**Auth helpers (src/lib/auth-helpers.ts):**
```
getCurrentUser()       session user or null
requireUser()          redirects /login if not signed in
requireApproved()      requireUser + status=approved + onboarded check
requireRideManager()   requireApproved + leader|organiser|admin (404s members)
requireAdmin()         requireApproved + admin (redirects non-admins)
canManageRides(role)   boolean — leader | organiser | admin
```

**Authorization:** application-level (no RLS). Every Server Action / Server Component gates via the helpers above and scopes DB queries by `user.id`. Never trust the JWT for security-critical mutations — re-read from DB at action time.

## Schema (10 tables)

**Auth.js tables** (managed by adapter): `users`, `accounts`, `verificationTokens`

`users` is extended with KHCC profile fields: `role`, `status` (pending/approved/rejected), `paceGroup` (rider's preferred pace), `onboardedAt`, `bike`, `stravaHandle`, `bio`, `hideFromDirectory`.

`users_private` — emergency contact (name + phone). Kept in a separate table so no query against `users` can accidentally leak it. Only join this table in admin-gated or self-only paths.

`rides` — event header: title, starts_at, start_point (lat/lng), distance/elevation (defaults), route_url, description, status (scheduled/weather-watch/cancelled/completed), cancellation audit columns.

`ride_pace_groups` — **one or many per ride**, each with its own pace_code (FK → ride_types), leader, cap, distance/elevation overrides, notes, per-pace status (scheduled/cancelled). Unique on (ride_id, pace_code).

`ride_rsvps` — (ride_id, user_id) PK → one pace per rider per ride. Has `pace_group_id` FK so RSVPs are tied to the specific pace chosen. Switching pace = upsert updates `pace_group_id`.

`ride_types` — admin-editable pace catalogue: code, name, description, color preset, position, active. Replaces the old hardcoded A/B/C enum.

`content_blocks` — key-value admin CMS for the landing page ("about", "achievements").

`gallery_photos` — admin-uploaded photos shown in the landing-page carousel.

## Multi-pace rides

A ride can offer A + B + C (or any subset of `ride_types`). Key points:
- One rider per ride, one pace (PK enforces it). Switching pace = upsert.
- Per-pace cancellation: admin can cancel just B while A and C run. If all paces cancel, ride auto-cancels.
- All leaders on the ride (any pace) can see emergency contacts for all RSVP'd riders — cross-pace visibility for safety.
- `ride_pace_groups.distanceKm/elevationM` override the ride-level defaults when set; fall back to `rides.distanceKm/elevationM` otherwise.

## Uploads

User-uploaded files go to the host-side bind-mount `./uploads/`, accessible inside the container at `/app/public/uploads/`. Next.js standalone doesn't include these in its build manifest, so they're served by the route handler at `src/app/uploads/[...path]/route.ts`.

Sub-directories:
- `uploads/avatars/` — profile avatars, 512×512 JPEG (sharp resize)
- `uploads/gallery/` — landing-page gallery photos, 1024×1024 JPEG (sharp)
- `uploads/routes/` — GPX files (`<rideId>.gpx`) + static map previews (`<rideId>-preview.jpg`)

Static map previews: generated server-side on GPX upload by `src/lib/static-map.ts` — stitches OSM tiles + SVG polyline overlay using sharp.

## Maps (Leaflet + OSM)

`src/components/map-picker.tsx` — client component (dynamic-imported, `ssr: false`). Used in two ways:
- **Admin ride form**: tap to drop a pin, fills lat/lng inputs. `src/components/location-fields.tsx` wraps it with the text inputs.
- **Ride detail**: read-only map with a dark-blue polyline overlay when a GPX exists (`src/components/ride-detail-map.tsx`).

OSM tile attribution must remain visible (policy requirement). Polyline color is `#1e40af` (dark blue).

## GPX upload

Admin uploads a `.gpx` file when creating/editing a ride. Server:
1. Parses distance (Haversine) + elevation gain (summed positive deltas, 0.5m noise threshold) — `src/lib/gpx.ts`
2. Overwrites the form's distance + elevation values (GPX always wins)
3. Saves raw file to `/uploads/routes/<rideId>.gpx`
4. Generates a static map preview (best-effort — failure never blocks the save)

Members on the ride detail page see the polyline on the map, a "Download GPX ↓" link, and a "Route ↗" link for the Strava/external URL.

## Email (SMTP via Gmail)

Transactional emails use Nodemailer → Gmail app password (`khcc.cyclingclub@gmail.com`). Set in `.env` as `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Sent for:
- Member approved / rejected / access removed (`src/app/admin/members/actions.ts`)

Helper: `sendEmail()` + `emailTemplate()` in `src/lib/email.ts`.

## Content + Gallery CMS

Admin-only pages under `/admin` (in the layout nav for `role=admin`):
- `/admin/members` — approval queue (pending/approved/rejected tabs), remove access
- `/admin/types` — add/edit/disable ride types with color presets
- `/admin/rides` — ride list; `/admin/rides/new` + `/admin/rides/[id]/edit`
- `/admin/content` — edit "About" + "Achievements" sections on the landing page
- `/admin/gallery` — upload/delete/edit-alt photos for the landing carousel

Ride managers (`leader | organiser | admin`) can access `/admin/rides` but not the other admin pages.

## Deployment

`khcc.nandharu.uk` on home server, behind a Cloudflare Tunnel → nginx-gateway → docker-compose on external `server-net`.

```bash
./scripts/deploy.sh   # pulls, roles password sync, builds, migrates, starts
```

Key env (on the server at `.env`):
- `POSTGRES_PASSWORD`, `PGHOST=khcc-db`, `PGUSER`, `PGDATABASE` — DB via PG* vars (not DATABASE_URL, which mangles passwords with special chars)
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_SITE_URL`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` — set once, passed as build arg AND runtime to keep action IDs stable across deploys
- `SMTP_*` — Gmail relay for approval emails

Migration runs automatically in `docker/entrypoint.sh` before Next.js boots. No manual step on deploy.

## Brand & UI

- Palette: `src/app/globals.css` `@theme` — coral pink `coral-*`, deep maroon `maroon-*`, coral red `flash-*`, cream `cream-*`. Semantic aliases: `brand`, `ink`, `paper`.
- Fonts: Bricolage Grotesque (display/headings), Inter (body).
- Hex-badge `.hex-clip` — pace badges, KHCC logo mark. **Pace badge always shows the letter** (NFR-6, never colour-only).
- Avatar shape: `rounded-full` (circle). Hex stays on the pace badges and branded badges, not user photos.
- Tap targets ≥ 44px (`button { min-height: 44px }` in globals — NFR-5, gloves).
- Color presets for ride types: coral / maroon / flash / emerald / sky / amber. Defined in `src/lib/ride-types.ts` — add a new preset there (all Tailwind class strings must be literal for build to include them).

## Don't

- Don't use managed services (Supabase, Vercel, Clerk, Auth0) — self-hosted is an explicit product decision.
- Don't hand-write SQL migrations — edit `src/db/schema.ts` and run `npm run db:generate`.
- Don't put `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `POSTGRES_PASSWORD` in Dockerfile `ARG` — runtime only.
- Don't select from `users_private` except in explicit admin/self-gated paths.
- Don't trust the JWT for security mutations — fetch fresh role from DB in the Server Action.
- Don't set `PGHOST=db` in docker-compose — use the container name `khcc-db` to avoid DNS collisions with other compose projects on the same `server-net` (this was the root cause of hours of password-mismatch debugging).
- Don't add features from Phase 2/3 (trips, Strava, races, leaderboard, live safety) — explicitly deferred.
