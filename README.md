# burkam_web

**Burkam** (Bubur Kampung Cycling) — a chill cycling group along East Coast Park to Changi Village. PWA for ride coordination.

Fully self-hosted, zero managed dependencies. Postgres + Auth.js + Next.js, all in Docker on a home server. Live at [burkam.nandharu.uk](https://burkam.nandharu.uk).

This codebase is a fork of an earlier "KHCC Web" project — see `docs/REQUIREMENTS*.{md,html}` and `docs/STAGE1.md` for product history. Architecture, schema and feature set are the same; the rebrand changes copy, theme and infra naming.

## What's in it (Phase 1, shipped)

- **Auth** — Google OAuth + email-credentials. Admin-approval queue. Auto-flip rejected → pending on re-sign-in.
- **Member terms** — required risk-waiver / agreement before onboarding; re-readable from the profile.
- **Onboarding** — name, photo, pace, bike, Strava handle, emergency contact (in a separate restricted table).
- **Rides** — single-pace by default (`chill`), multi-pace supported (one ride, multiple paces side-by-side), per-pace leader / cap / overrides, per-pace cancellation.
- **Recurring rides** — weekly / biweekly with **lazy materialisation** (one live future occurrence per series; cron spawns the next on cancel or completion).
- **Maps + GPX** — Leaflet on the client + Mapbox raster tiles (`mapbox/streets-v12` style by default), defaulted to East Coast / Changi. Tap-to-pin start point, GPX upload auto-fills distance + elevation, orange polyline overlay on detail map, downloadable GPX, server-rendered route preview image on the rides list. Self-closing `<trkpt/>` GPX accepted.
- **Weather** — Open-Meteo forecast pill on cards (icon + temp + wind chip when ≥ 20 km/h) and a full block on detail (sunrise/sunset, precip%).
- **Member directory** — `/members` with search and pace filter; click any rider in an RSVP list to view their profile.
- **Share for WhatsApp** — one-tap "Copy for WhatsApp" button on each ride detail page that copies a pre-formatted summary (date/time, location, distance, per-pace rider list with numbered names, join link) to the clipboard.
- **Admin tools** — approval queue, role assignment, ride types catalogue, landing-page CMS, gallery uploader, theme picker (4 themes).
- **PWA** — installable, conservative offline cache.

## Stack

Next.js 15 (App Router) + TypeScript strict · Tailwind v4 · **Postgres 16 in Docker** · **Drizzle ORM** · **Auth.js v5** (Google + email-credentials) · Leaflet + **Mapbox raster tiles** (OSM fallback for dev) · Sharp · Nodemailer (Brevo SMTP) · Open-Meteo · `@ducanh2912/next-pwa`.

## Local development

```bash
# 1. Install deps (Node 20+ required)
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in: POSTGRES_PASSWORD, AUTH_SECRET (openssl rand -base64 32),
# AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, NEXT_PUBLIC_SITE_URL,
# NEXT_PUBLIC_MAPBOX_TOKEN (URL-restricted to your origin),
# MAPBOX_SERVER_TOKEN (no URL restriction — for server-side preview gen).

# 3. Start Postgres locally (Docker)
docker run -d --name burkam-db-local \
  -e POSTGRES_USER=burkam -e POSTGRES_PASSWORD=burkam -e POSTGRES_DB=burkam \
  -p 5432:5432 postgres:16-alpine

# 4. Push schema + seed sample rides
npm run db:push
npx tsx scripts/seed-types.ts
npx tsx scripts/seed.ts

# 5. Run dev server
npm run dev
# open http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Run built app on :3030 (the prod port behind nginx) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate SQL migration from `src/db/schema.ts` changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly (dev shortcut, no migration file) |
| `npm run db:studio` | Open Drizzle Studio (DB GUI) |
| `npx tsx scripts/seed-types.ts` | Seed the default `chill` row in `ride_types` |
| `npx tsx scripts/seed.ts` | Seed 3 sample rides (idempotent) |

## Google OAuth setup (one-time)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
2. Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://burkam.nandharu.uk/api/auth/callback/google` (prod)
3. Copy the Client ID and Client Secret into `.env.local` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

No third-party identity service. The only thing leaving your server is the OAuth handshake to Google, and only on sign-in.

## Mapbox setup (one-time)

Two tokens, both at [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/) — free tier covers 200k tile requests/month, plenty for a small club.

| Token | Used by | URL restriction | Env var |
|---|---|---|---|
| **Public** | client-side Leaflet (`map-picker.tsx`) — embedded in JS bundle | `https://burkam.nandharu.uk/*` (recommended) | `NEXT_PUBLIC_MAPBOX_TOKEN` |
| **Server** | server-side route-preview JPEG generation (`static-map.ts`) | **none** (server fetches send no Referer header) | `MAPBOX_SERVER_TOKEN` |

The two-token split exists because URL-restricted tokens 403 on server-side fetches that have no `Referer` header. If you skip the server token, route preview JPEGs won't generate (the OSM fallback also 403s server-side under their tile-usage policy).

Set both in `.env`. The public one needs to be a build arg too — `./scripts/deploy.sh` handles that automatically.

## Deployment (home server)

Target: `burkam.nandharu.uk`. Two containers on the existing `server-net` Docker network: `burkam-db` (Postgres 16) and `burkam-web` (Next.js).

```bash
# On the home server, in the repo root:
cp .env.example .env  # fill in the production secrets

# First time only — drop the nginx snippet into the upstream nginx
sudo cp nginx/burkam.conf /etc/nginx/conf.d/burkam.conf
sudo nginx -t && sudo nginx -s reload

# Subsequent deploys
./scripts/deploy.sh
```

The deploy script brings up `db` first, waits for healthy, then builds and starts `burkam-web`. Migrations run automatically on container start (via `docker/entrypoint.sh`).

### Cron — recurring-ride materialisation

Generate a secret, put it in `.env` as `CRON_SECRET`, recreate the web container so the env propagates, then schedule the host crontab to hit the endpoint weekly:

```bash
# generate + persist the secret
CS=$(openssl rand -hex 32)
echo "CRON_SECRET=$CS" | sudo tee -a .env
docker compose up -d burkam-web

# crontab -e
0 19 * * 6 curl -s "https://burkam.nandharu.uk/api/cron/materialize-rides?secret=$CRON_SECRET" >> /var/log/burkam-cron.log 2>&1
```

The endpoint is idempotent — safe to hit any time.

## Documentation

- `docs/REQUIREMENTS.html` / `.md` — original V0.1 requirements (from the upstream KHCC project).
- `docs/REQUIREMENTS_V2.html` — implementation snapshot: what shipped, what's planned, what's deferred.
- `docs/STAGE1.md` — original Phase 1 implementation notes.
- `CLAUDE.md` — architectural guide for any contributor (or AI assistant) working on the codebase.
