# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What the project is

**Burkam Web** — a Progressive Web App for **Burkam** (Bubur Kampung Cycling). Chill weekend rides along TMCR from East Coast Park to Changi Village, mostly single-pace (occasionally multi-pace), stop for bubur kampung, head home. Replaces WhatsApp + spreadsheets for ride coordination.

Deployed at `https://burkam.nandharu.uk`. Implementation snapshot: `docs/REQUIREMENTS_V2.html`. Original requirements: `docs/REQUIREMENTS.md` / `.html`. (Both documents reference the original KHCC fork the codebase was derived from — kept as-is for product history.)

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

# One-off scripts (inside the container — docker exec burkam-web node node_modules/tsx/dist/cli.mjs scripts/<name>.ts)
scripts/seed.ts                      # seed 3 sample rides with pace groups
scripts/backfill-route-previews.ts   # generate static map preview images for existing GPX files
scripts/send-test-email.ts <addr>    # test SMTP relay
```

## Architecture

**Stack — fully self-hosted, zero managed dependencies:**
Next.js 15 App Router + TypeScript strict · Tailwind v4 · **Postgres 16 in Docker** · **Drizzle ORM** · **Auth.js v5** (Google OAuth + email credentials) · Leaflet (Mapbox raster tiles, OSM fallback) · Sharp (image resizing) · Nodemailer (Brevo SMTP relay) · Open-Meteo (weather) · `@ducanh2912/next-pwa`.

No Supabase, no Vercel, no Resend, no Mapbox, no third-party identity service beyond Google OAuth at sign-in time.

## Auth flow

Two providers on `/login`:
- **Google** — OAuth, verified email, redirects back through `/api/auth/callback/google`
- **Email credentials** — user types email, no password, no magic link. Server either creates a new user (`status=pending`) or signs in the existing one. If rejected → auto-flip to `pending` on re-sign-in.

After sign-in:
- `acceptedTermsAt` null → `/terms` (member agreement + risk waiver — must accept first)
- `onboardedAt` null → `/onboarding`
- `status` pending/rejected → `/pending`
- `status` approved → `/rides`

Session JWT carries `id`, `role`, `status`, `onboarded`, `termsAccepted`. Refreshed from DB on every request while `!approved`, `!onboarded`, or `!termsAccepted` (transient states that need to propagate without re-login). Once approved + onboarded + terms-accepted, JWT caches — no per-request DB hit.

**Auth helpers (src/lib/auth-helpers.ts):**
```
getCurrentUser()       session user or null
requireUser()          redirects /login if not signed in
requireApproved()      requireUser + termsAccepted + onboarded + status=approved
requireRideManager()   requireApproved + leader|organiser|admin (404s members)
requireAdmin()         requireApproved + admin (redirects non-admins)
canManageRides(role)   boolean — leader | organiser | admin
```

**Authorization:** application-level (no RLS). Every Server Action / Server Component gates via the helpers above and scopes DB queries by `user.id`. Never trust the JWT for security-critical mutations — re-read from DB at action time.

## Schema (11 tables)

**Auth.js tables** (managed by adapter): `users`, `accounts`, `verificationTokens`

`users` is extended with Burkam profile fields: `role`, `status` (pending/approved/rejected), `paceGroup` (rider's preferred pace), `acceptedTermsAt`, `onboardedAt`, `bike`, `stravaHandle`, `bio`, `hideFromDirectory`.

`users_private` — emergency contact (name + phone). Kept in a separate table so no query against `users` can accidentally leak it. Only join this table in admin-gated or self-only paths.

`ride_series` — recurring-ride template: title, rule (`weekly` | `biweekly`), weekday, time_of_day, start point, defaults, `pace_groups_template` (JSON snapshot), `active`. **Lazy materialisation** keeps exactly one live future occurrence per series.

`rides` — event header: title, starts_at, start_point (lat/lng), distance/elevation (defaults), route_url, description, `series_id` (nullable FK), status (scheduled/weather-watch/cancelled/completed), cancellation audit columns.

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

## Recurring rides (lazy materialisation)

Series live in `ride_series` (`weekly` | `biweekly`). Implementation in `src/lib/series.ts`. Invariant: **at most one live future occurrence per active series at any time.**

`materializeSeries(series)`:
1. Sweeps stale future occurrences for the series — deletes any beyond the soonest non-cancelled one **that has no RSVPs** (the FK cascade drops pace groups + rsvps automatically).
2. If no live future occurrence remains, generates the next date from the series template (pivot = latest existing ride's `starts_at`, or `now` if none) and inserts the ride + pace groups from the JSON template.

Trigger points: cron at `/api/cron/materialize-rides` (protected by `CRON_SECRET`), series creation in admin, and ride/pace cancellation that takes the whole ride down. All idempotent.

**Don't reintroduce a 4-week-ahead horizon** — the original implementation pivoted from epoch when `materialize_through_at` was null, which generated thousands of historical rides on first run. The new code reads only `latest existing ride` as pivot and never `new Date(0)`.

## Member directory + profile

`/members` — searchable directory of approved members. Photo, name, pace badge, bike. Excludes `hide_from_directory = true`. Search by name/bike, filter by pace.

`/members/[id]` — public profile. Photo, name, role badge (only if leader/organiser/admin), pace, bike, Strava deep-link, bio. **Hide-from-directory only suppresses listing** — direct profile URLs still resolve. Email and emergency contact are never on this page.

Rider names in any ride's RSVP list are clickable links to the profile.

## Terms / member agreement

`/terms` — Burkam member agreement (13 sections, in `src/lib/terms.ts`). Required checkbox + Continue gate before onboarding. `users.accepted_terms_at` stamps on submit; the JWT carries `termsAccepted` and refreshes from DB while false.

The page is also re-readable for accepted users — show a "Back to profile" link instead of the form, with the acceptance date displayed. Linked from `/profile` via "View member agreement".

When you ever change the wording materially, bump `TERMS_EFFECTIVE_DATE` in `src/lib/terms.ts` and (if you want a re-prompt) compare it to `accepted_terms_at` in the auth helpers.

## Weather (Open-Meteo)

`src/lib/weather.ts` — free, no key, 16-day hourly forecast. Cached via Next.js `fetch revalidate: 3600` so 14 list cards don't hammer the API on every page load.

Surfaces:
- Rides list cards: emoji + temp, plus a coral wind chip when wind ≥ 20 km/h (`WIND_THRESHOLD_KPH`).
- Ride detail page: full block with icon, label, temp, wind (red if windy), precip%, sunrise/sunset in location-local time.

Falls back to no UI silently when the ride has no lat/lng, the date is in the past or > 16 days out, or the API fails.

## Uploads

User-uploaded files go to the host-side bind-mount `./uploads/`, accessible inside the container at `/app/public/uploads/`. Next.js standalone doesn't include these in its build manifest, so they're served by the route handler at `src/app/uploads/[...path]/route.ts`.

Sub-directories:
- `uploads/avatars/` — profile avatars, 512×512 JPEG (sharp resize)
- `uploads/gallery/` — landing-page gallery photos, 1024×1024 JPEG (sharp)
- `uploads/routes/` — GPX files (`<rideId>.gpx`) + static map previews (`<rideId>-preview.jpg`)

Static map previews: generated server-side on GPX upload by `src/lib/static-map.ts` — stitches Mapbox tiles + SVG polyline overlay using sharp. Falls back to OSM tiles when `NEXT_PUBLIC_MAPBOX_TOKEN` is unset.

## Maps (Leaflet + Mapbox)

`src/components/map-picker.tsx` — client component (dynamic-imported, `ssr: false`). Used in two ways:
- **Admin ride form**: tap to drop a pin, fills lat/lng inputs. `src/components/location-fields.tsx` wraps it with the text inputs.
- **Ride detail**: read-only map with a dark-blue polyline overlay when a GPX exists (`src/components/ride-detail-map.tsx`).

Tile source is **Mapbox raster** (`mapbox/streets-v12` style, swap to `outdoors-v12` or `satellite-streets-v12` in `MAPBOX_STYLE` if you want a different look).

**Two-token pattern:**
- `NEXT_PUBLIC_MAPBOX_TOKEN` — embedded in the client JS bundle (build arg). URL-restrict it to `https://burkam.nandharu.uk/*` in the Mapbox dashboard since it ships in plaintext.
- `MAPBOX_SERVER_TOKEN` — used only by `src/lib/static-map.ts` for the server-side route-preview JPEG generation. Must have **no URL restriction**, because server-side fetches send no `Referer` header → URL-restricted tokens 403. Runtime env only, never reaches the client.

When both tokens are empty, both `MapPicker` and `static-map.ts` fall back to public OSM tiles, and the picker shows a small "token not set" notice. (Note: OSM has been blocking server-side tile fetches with 403 — server preview generation only works reliably with a Mapbox token.)

Mapbox+OSM attribution must remain visible (Mapbox ToS + OSM policy). Polyline color is `#1e40af` (dark blue).

## GPX upload

Admin uploads a `.gpx` file when creating/editing a ride. Server:
1. Parses distance (Haversine) + elevation gain (summed positive deltas, 0.5m noise threshold) — `src/lib/gpx.ts`
2. Overwrites the form's distance + elevation values (GPX always wins)
3. Saves raw file to `/uploads/routes/<rideId>.gpx`
4. Generates a static map preview (best-effort — failure never blocks the save)

Members on the ride detail page see the polyline on the map, a "Download GPX ↓" link, and a "Route ↗" link for the Strava/external URL.

## Email (SMTP via Brevo)

Transactional emails use Nodemailer → Brevo (formerly Sendinblue) so we can send from `noreply@burkam.nandharu.uk` with proper SPF/DKIM rather than relying on a Gmail relay. Set in `.env` as `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER` (Brevo account email), `SMTP_PASSWORD` (SMTP key from Brevo dashboard → SMTP & API), `SMTP_FROM`. The sending domain must be verified in Brevo first — they hand you SPF + DKIM TXT records to add at the DNS provider. Sent for:
- Member approved / rejected / access removed (`src/app/admin/members/actions.ts`)

Helper: `sendEmail()` + `emailTemplate()` in `src/lib/email.ts`. Provider-agnostic — `nodemailer.createTransport({ host, port, auth })` works against any SMTP relay; switching providers is a pure env change.

## Content + Gallery CMS

Admin-only pages under `/admin` (in the layout nav for `role=admin`):
- `/admin/members` — approval queue (pending/approved/rejected tabs), remove access
- `/admin/types` — add/edit/disable ride types with color presets
- `/admin/rides` — ride list; `/admin/rides/new` + `/admin/rides/[id]/edit`
- `/admin/content` — edit "About" + "Achievements" sections on the landing page
- `/admin/gallery` — upload/delete/edit-alt photos for the landing carousel

Ride managers (`leader | organiser | admin`) can access `/admin/rides` but not the other admin pages.

## Deployment

`burkam.nandharu.uk` on home server, behind a Cloudflare Tunnel → nginx-gateway → docker-compose on external `server-net`.

```bash
./scripts/deploy.sh   # pulls, roles password sync, builds, migrates, starts
```

Key env (on the server at `.env`):
- `POSTGRES_PASSWORD`, `PGHOST=burkam-db`, `PGUSER`, `PGDATABASE` — DB via PG* vars (not DATABASE_URL, which mangles passwords with special chars)
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_SITE_URL`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` — set once, passed as build arg AND runtime to keep action IDs stable across deploys
- `SMTP_*` — Brevo SMTP relay for transactional emails (sender domain must be verified in Brevo first)
- `CRON_SECRET` — protects `/api/cron/materialize-rides`. Set once with `openssl rand -hex 32`, then recreate the container so the env propagates. Schedule the cron in host crontab (e.g. weekly).

Migration runs automatically in `docker/entrypoint.sh` before Next.js boots. No manual step on deploy.

## Brand & UI

- Palette: `src/app/globals.css` `@theme` — coral pink `coral-*`, deep maroon `maroon-*`, coral red `flash-*`, cream `cream-*`. Semantic aliases: `brand`, `ink`, `paper`.
- Fonts: Bricolage Grotesque (display/headings), Inter (body).
- Hex-badge `.hex-clip` — pace badges, Burkam logo mark. **Pace badge always shows the letter** (NFR-6, never colour-only).
- Avatar shape: `rounded-full` (circle). Hex stays on the pace badges and branded badges, not user photos.
- Tap targets ≥ 44px (`button { min-height: 44px }` in globals — NFR-5, gloves).
- Color presets for ride types: coral / maroon / flash / emerald / sky / amber. Defined in `src/lib/ride-types.ts` — add a new preset there (all Tailwind class strings must be literal for build to include them).

## Don't

- Don't use managed services (Supabase, Vercel, Clerk, Auth0) — self-hosted is an explicit product decision.
- Don't hand-write SQL migrations — edit `src/db/schema.ts` and run `npm run db:generate`.
- Don't put `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `POSTGRES_PASSWORD` in Dockerfile `ARG` — runtime only.
- Don't select from `users_private` except in explicit admin/self-gated paths.
- Don't trust the JWT for security mutations — fetch fresh role from DB in the Server Action.
- Don't set `PGHOST=db` in docker-compose — use the container name `burkam-db` to avoid DNS collisions with other compose projects on the same `server-net` (this was the root cause of hours of password-mismatch debugging in the original KHCC fork).
- Don't reintroduce eager materialisation of recurring rides — the lazy approach is deliberate (member-list sanity + cleaner data).
- Don't list every ride on `/admin/rides` — default to recent + future and disable RSC `prefetch` on the per-row Edit links. Wide row counts × Safari prefetch storms = self-DoS via the nginx rate-limit zone.
- Don't use `localhost` in container healthchecks — Next.js binds IPv4 `0.0.0.0` only; `localhost` resolves to `::1` and the check fails forever. Use `127.0.0.1`.
- Don't add features from Phase 2/3 (trips, Strava, races, leaderboard, live safety) — explicitly deferred. See `docs/REQUIREMENTS_V2.html` for the full status of every requirement.
