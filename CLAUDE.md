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
scripts/seed-types.ts                # seed default `chill` + `pacy` rows in ride_types
scripts/seed.ts                      # seed 3 sample rides with pace groups
scripts/backfill-route-previews.ts   # generate static map preview images for existing GPX files
scripts/send-test-email.ts <addr>    # test SMTP relay
```

## Architecture

**Stack — fully self-hosted, zero managed dependencies:**
Next.js 15 App Router + TypeScript strict · Tailwind v4 · **Postgres 16 in Docker** · **Drizzle ORM** · **Auth.js v5** (Google OAuth + email credentials) · Leaflet (Mapbox raster tiles, OSM fallback) · Sharp (image resizing) · Nodemailer (Brevo SMTP relay) · Open-Meteo (weather) · `@ducanh2912/next-pwa`.

No Supabase, no Vercel, no Resend, no third-party identity service beyond Google OAuth at sign-in time. Mapbox is used for map tiles only (free tier, easy to self-replace via the `TileLayer` URL); the rest is fully self-hosted.

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

## Schema (13 tables)

**Auth.js tables** (managed by adapter): `users`, `accounts`, `verificationTokens`

`users` is extended with Burkam profile fields: `role`, `status` (pending/approved/rejected), `paceGroup` (rider's preferred pace), `acceptedTermsAt`, `onboardedAt`, `bike`, `stravaHandle`, `bio`, `hideFromDirectory`.

`users_private` — emergency contact (name + phone). Kept in a separate table so no query against `users` can accidentally leak it. Only join this table in admin-gated or self-only paths.

`ride_series` — recurring-ride template: title, rule (`weekly` | `biweekly`), weekday, time_of_day, start point, defaults, `pace_groups_template` (JSON snapshot), `active`. **Lazy materialisation** keeps exactly one live future occurrence per series. The route GPX is *not* a column — it's kept as a seed file on disk at `/uploads/routes/series-<id>.gpx` and copied into each occurrence (see "Series seed GPX").

`rides` — event header: title, starts_at, start_point (lat/lng), distance/elevation (defaults), route_url, description, `series_id` (nullable FK), status (scheduled/weather-watch/cancelled/completed), cancellation audit columns. **Recap columns** (`recap_note`, `recap_by`, `recap_at`) are populated post-ride by a leader/admin once the ride flips to `completed`.

`ride_pace_groups` — **one or many per ride**, each with its own pace_code (FK → ride_types), leader, cap, distance/elevation overrides, notes, per-pace status (scheduled/cancelled). Unique on (ride_id, pace_code).

`ride_rsvps` — (ride_id, user_id) PK → one pace per rider per ride. Has `pace_group_id` FK so RSVPs are tied to the specific pace chosen. Switching pace = upsert updates `pace_group_id`.

`ride_types` — admin-editable pace catalogue: code, name, description, color preset, position, active. Replaces the old hardcoded A/B/C enum.

`route_library` — admin-curated GPX tracks selectable from the ride form. Fields: id, name, description, distance_km, elevation_m, uploaded_by. The on-disk GPX lives at `/uploads/library/<id>.gpx`.

`ride_photos` — recap photos attached to a completed ride. Cascade-deletes when the ride is removed. Uploaded by any approved member, capped at 3 per uploader per ride at the action layer. On-disk path: `/uploads/ride-photos/<id>.jpg`.

`content_blocks` — key-value admin CMS for the landing page. Currently surfaces "about" only; the "achievements" / trophy-case block is **parked** (hidden from both the public landing page and the admin content editor) and can be revived by removing `"achievements"` from `HIDDEN_BLOCK_KEYS` in `src/app/admin/content/page.tsx` and uncommenting the matching JSX block in `src/app/page.tsx`. The DB row is preserved either way.

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
2. If no live future occurrence remains, generates the next date from the series template (pivot = latest existing ride's `starts_at`, or `now` if none) and inserts the ride + pace groups from the JSON template. It picks the **first generated date strictly after `now`** — pivoting off the latest ride keeps the weekly/biweekly cadence stable, but if the series went dormant (cron off for a while) the nearest on-cadence date can already be in the past, so those are skipped to always surface a real upcoming ride.
3. Copies the series' **seed GPX** into the new occurrence's per-ride slot and regenerates its static preview (best-effort — see "Series seed GPX" below).

Trigger points: cron at `/api/cron/materialize-rides` (protected by `CRON_SECRET`), series creation in admin, ride/pace cancellation that takes the whole ride down, and **lazy keep-up on every `/rides` load** (`keepSeriesFresh()` in `src/app/rides/page.tsx`). All idempotent. The same cron endpoint also calls `autoCompletePastRides()` (see "Post-ride recap" below).

**Why the lazy keep-up exists:** completing a ride is **not** a materialisation trigger — only the four above are. Without `keepSeriesFresh()`, once the last occurrence flips to `completed` (and drops out of the `notInArray(status, ["cancelled","completed"])` list query) the next one isn't created until the host cron next fires, so the list goes empty in between. `keepSeriesFresh()` runs `autoCompletePastRides()` + `materializeSeries()` for every active series on each list load — self-healing regardless of how the prior occurrence ended or whether cron is running. It's best-effort (try/catch) so a failure there can never blank the page. The cron is still the safety net for when nobody's viewing the list.

**Series seed GPX:** a `ride_series` row stores the meeting point, distance/elevation numbers, and external `route_url` — but **not** the GPX track. The route is kept as a "seed" file on disk at `/uploads/routes/series-<seriesId>.gpx` (helpers in `src/lib/upload.ts`: `saveSeriesSeedGpx`, `copySeriesSeedGpxToRide`, `seriesSeedExists`, `promoteRideGpxToSeriesSeed`). `createRide` writes the seed when a recurring ride is created with a GPX (upload or library); `materializeSeries` copies it into each new occurrence's `<rideId>.gpx` slot and regenerates the per-ride preview, so **every week inherits the same polyline + GPX download + preview**, not just week one. For series created before seeding existed, `materializeSeries` self-heals: if no seed exists it promotes a prior occurrence's on-disk GPX to the seed first. The `series-` filename prefix can't collide with per-ride `<rideId>.gpx` (both UUIDs), and lives in the already-allowlisted `routes/` subdir.

**Don't reintroduce a 4-week-ahead horizon** — the original implementation pivoted from epoch when `materialize_through_at` was null, which generated thousands of historical rides on first run. The new code reads only `latest existing ride` as pivot and never `new Date(0)`.

## Post-ride recap

Once a ride flips to `status=completed`, the detail page grows a recap section: a leader-editable note (`rides.recap_note`) and a member-uploadable photo grid (`ride_photos`). Browse them all at `/rides/past`.

**Completion paths** (any of):
1. **Lazy-on-read** — first time anyone opens `/rides/<id>` after the ride's estimated end, `maybeAutoCompleteRide()` flips the status inline before render. No infra change, fastest in practice.
2. **Cron** — `/api/cron/materialize-rides` also runs `autoCompletePastRides()` on every hit. Idempotent.
3. **Manual button** — `/admin/rides/<id>/edit` shows "Mark as completed" for ride managers (`canManageRides`). Skips the wait when a leader just wants to post the recap immediately.

The "estimated end" is **distance-based** (`estimateRideHours` in `src/lib/series.ts`): `max(2h, distance_km / 14)`, with a `4h` fallback when distance is null. 14 km/h is Burkam's chill-pace + bubur-stop average; the floor stops aggressive flips on very short rides. Tune the constants there if rides regularly run longer.

**Reopening a completed ride:** `/admin/rides/<id>/edit` shows a **Reopen ride** button for ride managers when status is `completed` (`reopenRide` action). It flips the ride back to `scheduled` so a wrong date/time can be amended and the ride returns to the active `/rides` list. The edit form is editable for completed rides (only `cancelled` rides are read-only). **Gotcha:** auto-complete is distance/time-based, so reopening a ride whose start time is still in the past will get auto-completed straight back (cron + lazy-on-read). The intended flow is therefore reopen → edit the date to a future time → save, which is why `reopenRide` redirects back to the edit page (not the detail page) to position the admin to fix the date immediately.

**Recap UX:**
- Leader recap: any leader on the ride (any pace) or admin/organiser. `RecapEditor` toggles between view + edit.
- Photos: any approved member. Hard cap of 3 per uploader per ride enforced server-side in `uploadRidePhoto`. Delete is uploader-or-manager. Files served from `/uploads/ride-photos/<id>.jpg` (sharp-resized to max 1600 px, `fit: "inside"` to preserve aspect).
- `/rides/past` lists completed rides desc — title, date, distance/elev, attendee count, photo count, recap snippet (140 chars).

The Next-rides query at `/rides` excludes both `cancelled` AND `completed` — `notInArray(status, ["cancelled", "completed"])`. The detail page also hides the RSVP button on completed rides (defense-in-depth — RSVP-after-the-fact makes no sense). The `toggleRsvp` action itself isn't gated; the UI is the only enforcement.

## Route library

Admin-curated catalogue of GPX tracks the ride form can pick from instead of re-uploading the same file every weekend. Page at `/admin/routes` (admin-only, modeled on `/admin/gallery`).

**On the ride form:** `<RouteSourcePicker>` (`src/components/route-source-picker.tsx`) shows a dropdown of library routes plus the existing file input. They're **mutually exclusive** — picking from the library clears the file input and vice versa, last action wins. The notice line below shows `📍 <name>` or `📁 <filename>` so the active source is unambiguous before submit.

**Server flow** (`src/app/admin/rides/actions.ts → maybeResolveGpxSource`):
- Upload wins if a file came through (defensive — the picker should ensure only one source).
- Library: read `/uploads/library/<id>.gpx` from disk, parse for distance/elevation, return as the source.
- Either way the resolved GPX is **copied** into the per-ride slot at `/uploads/routes/<rideId>.gpx`. The ride detail page is unchanged — it always loads from the per-ride slot. Copying (not symlinking) means deleting a library entry doesn't break already-saved rides.

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

The route handler enforces an explicit subdir allowlist (path-traversal defence). When you add a new subdir, **also add it to `ALLOWED_SUBDIRS` in that file**, otherwise the URL 404s and images render as broken-icons even though the file is on disk.

Sub-directories:
- `uploads/avatars/` — profile avatars, 512×512 JPEG (sharp resize)
- `uploads/gallery/` — landing-page gallery photos, 1024×1024 JPEG (sharp)
- `uploads/routes/` — per-ride GPX (`<rideId>.gpx`) + static map previews (`<rideId>-preview.jpg`), plus recurring-series seed GPX (`series-<seriesId>.gpx`)
- `uploads/library/` — admin-curated library GPXs (`<libraryId>.gpx`) + previews (`<libraryId>-preview.jpg`)
- `uploads/ride-photos/` — recap photos (`<photoId>.jpg`), max 1600 px `fit: inside`

Static map previews: generated server-side on GPX upload by `src/lib/static-map.ts` — stitches Mapbox tiles + SVG polyline overlay using sharp. Falls back to OSM tiles when `NEXT_PUBLIC_MAPBOX_TOKEN` is unset. The function takes an optional `subdir` argument so the same generator writes both ride previews (`routes/`) and library previews (`library/`).

## Maps (Leaflet + Mapbox)

`src/components/map-picker.tsx` — client component (dynamic-imported, `ssr: false`). Used in two ways:
- **Admin ride form**: tap to drop a pin, fills lat/lng inputs. `src/components/location-fields.tsx` wraps it with the text inputs.
- **Ride detail**: read-only map with an orange polyline overlay when a GPX exists (`src/components/ride-detail-map.tsx`).

Tile source is **Mapbox raster** (`mapbox/streets-v12` style, swap to `outdoors-v12` or `satellite-streets-v12` in `MAPBOX_STYLE` if you want a different look).

**Two-token pattern:**
- `NEXT_PUBLIC_MAPBOX_TOKEN` — embedded in the client JS bundle (build arg). URL-restrict it to `https://burkam.nandharu.uk/*` in the Mapbox dashboard since it ships in plaintext.
- `MAPBOX_SERVER_TOKEN` — used only by `src/lib/static-map.ts` for the server-side route-preview JPEG generation. Must have **no URL restriction**, because server-side fetches send no `Referer` header → URL-restricted tokens 403. Runtime env only, never reaches the client.

When both tokens are empty, both `MapPicker` and `static-map.ts` fall back to public OSM tiles, and the picker shows a small "token not set" notice. (Note: OSM has been blocking server-side tile fetches with 403 — server preview generation only works reliably with a Mapbox token.)

Mapbox+OSM attribution must remain visible (Mapbox ToS + OSM policy). Polyline color is `#FC5201` (orange).

## GPX upload

Admin uploads a `.gpx` file when creating/editing a ride **or** picks a pre-curated route from the library (see "Route library" above). Server:
1. Resolves the source — file upload, library entry, or null (`maybeResolveGpxSource`).
2. Parses distance (Haversine) + elevation gain (summed positive deltas, 0.5m noise threshold) — `src/lib/gpx.ts`
3. Overwrites the form's distance + elevation values (GPX always wins)
4. Saves raw file to `/uploads/routes/<rideId>.gpx` (upload → `saveRouteGpx`, library → `copyLibraryGpxToRide`)
5. Generates a static map preview (best-effort — failure never blocks the save)

The parser regex accepts both paired (`<trkpt>...</trkpt>`) and self-closing (`<trkpt ... />`) forms. Route-planner exports without elevation/time data emit the self-closing form; rejecting them was the cause of an early "Could not read any track points" failure.

Members on the ride detail page see the polyline on the map, a "Download GPX ↓" link, and a "Route ↗" link for the Strava/external URL.

## Sharing rides (Copy for WhatsApp)

Ride detail page has a `📋 Copy for WhatsApp` button (`src/components/copy-ride-button.tsx`) that copies a pre-formatted plain-text summary to the clipboard for pasting into chat / SMS / email. Format builder is `buildRideShareText()` in `src/lib/share.ts`. **Time formatter is pinned to UTC** — same as the rest of the app's server-rendered `toLocaleString(undefined)` calls — so the share text matches what the organiser typed in the form. (Underlying gotcha: `datetime-local` strings are parsed as server-local time, and the production container runs UTC, so the stored instant doesn't actually correspond to Singapore wall-clock; pinning to UTC keeps the display consistent. If we ever fix the storage layer to be timezone-correct, flip this back to `Asia/Singapore` and add a backfill.) Cancelled paces are omitted from the share (still visible on the page); a fully cancelled ride prefixes the title with `❌ CANCELLED — `.

## Form-validation errors

Server actions on the new/edit ride form (`src/app/admin/rides/actions.ts`) distinguish user-input errors from real failures via a `FormError` class. The validation prelude (`parseRideInput`, `parsePaceGroups`, `maybeMergeGpx`) throws `FormError`; `createRide`/`updateRide` catch them and `redirect("?error=<msg>")` back to the form page, which renders an inline coral banner. Anything that isn't a `FormError` propagates as a real 500. Use the same pattern when adding new validation paths — naked `throw new Error(...)` produces an unhelpful "Application error" page in production because Next.js scrubs the original message.

The ride-type admin actions (`src/app/admin/types/actions.ts`) follow the same `FormError` → `redirect("/admin/types?error=<msg>")` → inline banner pattern.

## Email (SMTP via Brevo)

Transactional emails use Nodemailer → Brevo (formerly Sendinblue) so we can send from `noreply@burkam.nandharu.uk` with proper SPF/DKIM rather than relying on a Gmail relay. Set in `.env` as `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER` (Brevo account email), `SMTP_PASSWORD` (SMTP key from Brevo dashboard → SMTP & API), `SMTP_FROM`. The sending domain must be verified in Brevo first — they hand you SPF + DKIM TXT records to add at the DNS provider. Sent for:
- Member approved / rejected / access removed (`src/app/admin/members/actions.ts`)

Helper: `sendEmail()` + `emailTemplate()` in `src/lib/email.ts`. Provider-agnostic — `nodemailer.createTransport({ host, port, auth })` works against any SMTP relay; switching providers is a pure env change.

## Content + Gallery CMS

Admin-only pages under `/admin` (in the layout nav for `role=admin`):
- `/admin/members` — approval queue (pending/approved/rejected tabs), remove access
- `/admin/types` — add/edit/disable ride types with color presets
- `/admin/rides` — ride list; `/admin/rides/new` + `/admin/rides/[id]/edit`. Edit page has the **Mark as completed** button for ride managers when status is `scheduled`, and a **Reopen ride** button when status is `completed` (flips back to `scheduled` so a wrong date/time can be amended — see "Post-ride recap").
- `/admin/routes` — route library (admin-only): name + description + GPX upload, list with edit + delete + per-route preview
- `/admin/content` — edit landing-page sections. Currently exposes the "About" block only ("achievements" is hidden via `HIDDEN_BLOCK_KEYS` until we revive the trophy case)
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
- `NEXT_PUBLIC_MAPBOX_TOKEN` — client-side Mapbox token, URL-restricted to your domain (build arg + runtime). Falls back to OSM if unset.
- `MAPBOX_SERVER_TOKEN` — server-side Mapbox token for `static-map.ts`, **no URL restriction** (server fetches send no Referer). Runtime only.
- `SMTP_*` — Brevo SMTP relay for transactional emails (sender domain must be verified in Brevo first)
- `CRON_SECRET` — protects `/api/cron/materialize-rides`. Set once with `openssl rand -hex 32`, then recreate the container so the env propagates. Schedule the cron in host crontab (e.g. weekly).

Migration runs automatically in `docker/entrypoint.sh` before Next.js boots. No manual step on deploy.

## Brand & UI

- Palette: `src/app/globals.css` `@theme` — sky-blue brand on a near-white paper with pale-green wash; sunrise-orange accent. Tailwind token names are inherited from the upstream KHCC fork (`coral-*`, `maroon-*`, `flash-*`, `cream-*`) but their *values* were redefined for Burkam — read `coral-*` as "brand", `maroon-*` as "ink", `cream-*` as "paper", `flash-*` as "hot accent". Don't rename the tokens; renaming would touch dozens of components for zero behaviour change.
- Themes: `tropical` (default), `sunrise`, `lagoon`, `mono`. Picker at `/admin/theme` writes to `content_blocks.active_theme`; layout reads it and sets `<html data-theme="...">`. Add a theme by appending to `THEMES` in `src/lib/themes.ts` AND adding a `[data-theme="<key>"]` block in `globals.css`.
- Fonts: Bricolage Grotesque (display/headings), Inter (body).
- Hex-badge `.hex-clip` — pace badges only. The Burkam logo on the landing page is now a regular `<Image>` from `/icon-512.png`, not a hex clip. **Pace badge always shows the letter** (NFR-6, never colour-only).
- Avatar shape: `rounded-full` (circle). Hex stays on the pace badges and branded badges, not user photos.
- Tap targets ≥ 44px (`button { min-height: 44px }` in globals — NFR-5, gloves).
- Color presets for ride types: coral / maroon / flash / emerald / sky / amber. Defined in `src/lib/ride-types.ts` — add a new preset there (all Tailwind class strings must be literal for build to include them).
- Default pace catalogue: `chill` (single-pace, default), `pacy` (occasional faster bunch). Inherited `A` / `B` / `C` rows from the upstream fork are deactivated by migration `0009_burkam_pace_seed.sql`. Ride-type codes are stored **case-sensitively as typed** (Burkam's are lowercase words; legacy ones are uppercase letters) — don't normalise case in `parseInput`, or `updateRideType`'s immutable-code guard (`input.code !== code`) breaks for every lowercase row and crashes the save.
- PWA icons (`public/icon-*.png`, `apple-icon.png`) regenerated from `burkam_logo.png` (committed at repo root) via sharp. Re-run the regen script if the logo changes.

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
- Don't use a single URL-restricted Mapbox token for both client and server — server fetches have no Referer header and 403. Use the two-token pattern: `NEXT_PUBLIC_MAPBOX_TOKEN` (URL-restricted, public, build arg) for the client, `MAPBOX_SERVER_TOKEN` (no restriction, runtime only) for `static-map.ts`.
- Don't fall back to OSM tiles in production — `tile.openstreetmap.org` 403s server-side fetches under their tile-usage policy. The fallback exists for dev convenience; prod must have a Mapbox token.
- Don't `throw new Error("user message")` in admin server actions for validation. Use the `FormError` class — naked `Error` produces an unhelpful "Application error" 500 page in production because Next.js scrubs the original message for security.
- Don't forget to regenerate static map preview JPEGs after changing the polyline colour or tile source — they're cached on disk indefinitely. `rm -f /app/public/uploads/routes/*-preview.jpg && backfill-route-previews.ts`.
- Don't bake server-only secrets (`MAPBOX_SERVER_TOKEN`, `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `POSTGRES_PASSWORD`, `SMTP_PASSWORD`) into Dockerfile `ARG`s — keep them as runtime `environment:` only so they don't end up in the build context or layers.
- Don't add a new `/uploads/<subdir>/` without also adding the subdir to `ALLOWED_SUBDIRS` in `src/app/uploads/[...path]/route.ts`. Files write fine but the URL 404s and you get broken-image icons everywhere — silent and confusing.
- Don't restore the WhatsApp share's `timeZone: "Asia/Singapore"` without first fixing the underlying datetime-local storage. The current code intentionally pins to UTC so it matches the server-rendered `toLocaleString(undefined)` everywhere else; flipping just the share back to SGT will reintroduce the "ride at 7 AM, share says 3 PM" bug from the conversation history.
