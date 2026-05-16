# Stage 1 — what shipped, what's next

**Status:** Code scaffolded 2026-05-16, refactored to fully self-hosted stack same day. Awaiting Google OAuth credentials and first deploy.

## What's in Stage 1

| Surface | Notes |
|---|---|
| Public landing (`/`) | Hero, gallery strip from 6 jersey photos, "what is KHCC", sign-in CTA. Redirects signed-in users to `/rides` (or `/onboarding` if incomplete). |
| Sign in (`/login`) | Google OAuth via Auth.js. Email magic link and Apple deferred. |
| Auth handler (`/api/auth/[...nextauth]`) | Auth.js v5 routes (signin, callback, csrf, signout). |
| Onboarding (`/onboarding`) | Display name, pace group A/B/C, bike, Strava handle, emergency contact (private). Marks `users.onboarded_at`. |
| Ride list (`/rides`) | Next 14 days, cards with pace badge + RSVP count + RSVP toggle. Read-only — admins seed rides via Drizzle Studio (`npm run db:studio`) or SQL. |
| Ride detail (`/rides/[id]`) | Date/time, distance, elevation, description, route link, full RSVP list with avatars, sticky RSVP bar. |
| RSVP toggle | One tap In/Out via server action. No cap, no waitlist. |
| PWA shell | `manifest.json`, hex-badge SVG icon, `next-pwa` service worker (prod only). |

## Stack

Fully self-hosted. No managed services.

- **Next.js 15** App Router + TypeScript strict
- **Postgres 16** in Docker (`khcc-db` container, named volume)
- **Drizzle ORM** + drizzle-kit for migrations (schema-as-TS in `src/db/schema.ts`)
- **Auth.js v5** (NextAuth) with Google OAuth provider, Drizzle adapter, JWT session strategy
- **Tailwind v4** with palette derived from KHCC team kit photos
- **`@ducanh2912/next-pwa`** for service worker

## Schema (Drizzle, Postgres)

- `users` — Auth.js base columns (id, name, email, image) **plus** KHCC profile fields (role, paceGroup, bike, stravaHandle, onboardedAt, etc.)
- `accounts` — Auth.js OAuth account linking
- `verificationTokens` — Auth.js (unused in Stage 1, present for future email magic link)
- `users_private` — emergency contact, isolated table; never joined except in admin-or-self queries
- `rides` — title, startsAt, distance, elevation, paceGroup, status, leaderId
- `ride_rsvps` — composite PK (rideId, userId), status enum

Authorization is **application-level**: every Server Action / Server Component calls `requireUser()` first and scopes queries by user.id. No RLS (no Supabase auth context to key off).

## What's deferred to Stage 2+

From REQUIREMENTS.md Phase 1 MVP that did NOT make Stage 1:

- FR-2.3 Filters by pace / no-drop / date range
- FR-2.4 Map embed + weather forecast on ride detail
- FR-2.5 Recurring ride series (RRULE)
- FR-2.6 Status lifecycle UI (`weather-watch` / `cancelled` / `completed`) — column exists, no UI
- FR-3.2 / 3.3 Cap + waitlist with FIFO promotion
- FR-3.4 RSVP cutoff (configurable by leader)
- FR-3.5 "My Rides" view
- FR-4.3 Member directory page
- FR-4.4 Privacy toggles (hide name / hide from directory) — column exists, no UI
- FR-5 Ride leader self-serve create / edit / cancel UI (admin seeds via Drizzle Studio in Stage 1)
- FR-6 Announcements feed
- FR-7 Email reminders + web push + in-app notifications bell

Also deferred to Stage 1.5:

- Generate PNG icons from `public/icon.svg` (see `public/icons-todo.md`)
- Wire up nginx config on home server for `khcc.nandharu.uk`
- Daily DB backups (NFR-18) — see "Backups" section below

## Known small caveats

- `npm install` could not run during the scaffolding session (npm registry returned 403). Run it locally before first `npm run dev`.
- PNG manifest icons not yet generated — SVG fallback works in modern browsers but iOS/Android home-screen install prefers PNGs. See `public/icons-todo.md`.

## Home-server deploy walkthrough (`khcc.nandharu.uk`)

This mirrors the `learning_buddy` (`sora.nandharu.uk`) pattern: each app lives in its own repo, joins the external `server-net` Docker network, and is reverse-proxied by an upstream nginx that fronts other `*.nandharu.uk` subdomains.

### Prerequisites on the home server

- Docker + `docker compose` plugin
- The `server-net` external network already exists: `docker network ls | grep server-net`
- An upstream nginx with a `conf.d/` directory loaded into the proxy
- DNS: A record for `khcc.nandharu.uk` → home server IP (or via Cloudflare)

### Step 1 — Google OAuth credentials

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application)
2. Authorised redirect URI: `https://khcc.nandharu.uk/api/auth/callback/google`
3. Note the Client ID and Client Secret — you'll paste them into `.env`

### Step 2 — Clone and configure on the server

```bash
ssh you@home-server
cd /var/www                       # or wherever you keep *.nandharu.uk repos
git clone <this-repo-url> khcc_web
cd khcc_web

cp .env.example .env
nano .env                         # see below for what to fill in
```

`.env` should contain:

```
POSTGRES_USER=khcc
POSTGRES_PASSWORD=<long-random-string>
POSTGRES_DB=khcc

AUTH_SECRET=<openssl rand -base64 32>
AUTH_GOOGLE_ID=<from step 1>
AUTH_GOOGLE_SECRET=<from step 1>

NEXT_PUBLIC_SITE_URL=https://khcc.nandharu.uk
```

`DATABASE_URL` is set automatically inside the container from the `POSTGRES_*` vars.

### Step 3 — Wire up nginx (one-time)

```bash
sudo cp nginx/khcc.conf /etc/nginx/conf.d/khcc.conf
sudo nginx -t                     # syntax check
sudo nginx -s reload
```

If the upstream nginx runs as a Docker container, copy into whatever bind-mount feeds it.

### Step 4 — First deploy

```bash
./scripts/deploy.sh
```

The script:
1. `git pull origin main`
2. Brings up the `db` container, waits for healthy
3. Builds `khcc-web` (passes `NEXT_PUBLIC_SITE_URL` and `AUTH_GOOGLE_ID` as build args)
4. Brings up `khcc-web` — its entrypoint runs `drizzle-kit migrate` automatically before Next.js starts
5. Polls the web healthcheck

When healthy, hit `https://khcc.nandharu.uk` from a browser.

### Step 5 — Bootstrap your first admin

Sign in once via Google, then promote yourself. Either:

```bash
# Find your user id via Drizzle Studio:
docker exec -it khcc-web sh -c "cd /app && node ./node_modules/drizzle-kit/bin.cjs studio"
# (then open the URL it prints, edit your row's role)
```

Or via psql:

```bash
docker exec -it khcc-db psql -U khcc -d khcc \
  -c "update users set role = 'admin' where email = 'you@example.com';"
```

You're an admin now. To seed rides, exec a one-off seed script:

```bash
docker exec khcc-web node node_modules/tsx/dist/cli.mjs scripts/seed.ts
```

### Subsequent deploys

```bash
ssh you@home-server
cd /var/www/khcc_web
./scripts/deploy.sh
```

Migrations run automatically on container start via the entrypoint, so adding a new migration just means committing it and running `deploy.sh`.

If you change `nginx/khcc.conf`, copy it again and reload nginx.

### Backups (NFR-18 — set up before this app has real data)

```bash
# Cron entry, runs daily at 03:00
0 3 * * * docker exec khcc-db pg_dump -U khcc khcc | gzip > /var/backups/khcc/khcc-$(date +\%Y\%m\%d).sql.gz && find /var/backups/khcc -mtime +30 -delete
```

### Troubleshooting

- **502 from nginx** — container not running or not on `server-net`. `docker compose ps` and `docker network inspect server-net | grep khcc-web`.
- **`khcc-web` exits during migration** — `docker logs khcc-web` will show drizzle-kit output. Most often a `DATABASE_URL` mismatch or the db container not yet healthy.
- **OAuth redirect mismatch** — the Google Cloud Console redirect URI must be exactly `https://khcc.nandharu.uk/api/auth/callback/google`. Trailing slash, http vs https, all matter.
- **JWT decryption errors after redeploy** — `AUTH_SECRET` changed between builds, signing out all users. Don't rotate it casually.

## Open product questions still unresolved

(From REQUIREMENTS §11 — not blocking Stage 1, will block later stages):

- Primary ride region (timezone, weather provider, map centre)
- Membership model — open signup vs invite-only
- Ride capping norms (drives waitlist UX in Stage 2)
- WhatsApp bridging bot
