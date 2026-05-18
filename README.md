# khcc_web

**Knock House Chop Chop** — a fast-pace road cycling club. PWA for ride coordination.

Fully self-hosted, zero managed dependencies. Postgres + Auth.js + Next.js, all in Docker on a home server. Live at [khcc.nandharu.uk](https://khcc.nandharu.uk).

## What's in it (Phase 1, shipped)

- **Auth** — Google OAuth + email-credentials. Admin-approval queue. Auto-flip rejected → pending on re-sign-in.
- **Member terms** — required risk-waiver / agreement before onboarding; re-readable from the profile.
- **Onboarding** — name, photo, pace, bike, Strava handle, emergency contact (in a separate restricted table).
- **Rides** — multi-pace event header (one ride, A + B + C all on the same row), per-pace leader / cap / overrides, per-pace cancellation.
- **Recurring rides** — weekly / biweekly with **lazy materialisation** (one live future occurrence per series; cron spawns the next on cancel or completion).
- **Maps + GPX** — Leaflet + OpenStreetMap. Tap-to-pin start point, GPX upload auto-fills distance + elevation, polyline overlay on detail map, downloadable GPX, and a server-rendered route preview image on the rides list.
- **Weather** — Open-Meteo forecast pill on cards (icon + temp + wind chip when ≥ 20 km/h) and a full block on detail (sunrise/sunset, precip%).
- **Member directory** — `/members` with search and pace filter; click any rider in an RSVP list to view their profile.
- **Admin tools** — approval queue, role assignment, ride types catalogue (replaces the hardcoded A/B/C enum), landing-page CMS, gallery uploader.
- **PWA** — installable, conservative offline cache.

What's deliberately **not** here yet: announcements, ride email reminders, waitlist, Strava integration, overseas trips, race calendar, live safety. See `docs/REQUIREMENTS_V2.html` for the full implementation status.

## Stack

Next.js 15 (App Router) + TypeScript strict · Tailwind v4 · **Postgres 16 in Docker** · **Drizzle ORM** · **Auth.js v5** (Google + email-credentials) · Leaflet/OSM · Sharp · Nodemailer (Gmail) · Open-Meteo · `@ducanh2912/next-pwa`.

## Local development

```bash
# 1. Install deps (Node 20+ required)
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in: POSTGRES_PASSWORD, AUTH_SECRET (openssl rand -base64 32),
# AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, NEXT_PUBLIC_SITE_URL.

# 3. Start Postgres locally (Docker)
docker run -d --name khcc-db-local \
  -e POSTGRES_USER=khcc -e POSTGRES_PASSWORD=khcc -e POSTGRES_DB=khcc \
  -p 5432:5432 postgres:16-alpine

# 4. Push schema + seed sample rides
npm run db:push
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
| `npx tsx scripts/seed.ts` | Seed 3 sample rides (idempotent) |

## Google OAuth setup (one-time)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
2. Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://khcc.nandharu.uk/api/auth/callback/google` (prod)
3. Copy the Client ID and Client Secret into `.env.local` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

No third-party identity service. The only thing leaving your server is the OAuth handshake to Google, and only on sign-in.

## Deployment (home server)

Target: `khcc.nandharu.uk`. Two containers on the existing `server-net` Docker network: `khcc-db` (Postgres 16) and `khcc-web` (Next.js).

```bash
# On the home server, in the repo root:
cp .env.example .env  # fill in the production secrets

# First time only — drop the nginx snippet into the upstream nginx
sudo cp nginx/khcc.conf /etc/nginx/conf.d/khcc.conf
sudo nginx -t && sudo nginx -s reload

# Subsequent deploys
./scripts/deploy.sh
```

The deploy script brings up `db` first, waits for healthy, then builds and starts `khcc-web`. Migrations run automatically on container start (via `docker/entrypoint.sh`).

### Cron — recurring-ride materialisation

Generate a secret, put it in `.env` as `CRON_SECRET`, recreate the web container so the env propagates, then schedule the host crontab to hit the endpoint weekly:

```bash
# generate + persist the secret
CS=$(openssl rand -hex 32)
echo "CRON_SECRET=$CS" | sudo tee -a .env
docker compose up -d khcc-web

# crontab -e
0 19 * * 6 curl -s "https://khcc.nandharu.uk/api/cron/materialize-rides?secret=$CRON_SECRET" >> /var/log/khcc-cron.log 2>&1
```

The endpoint is idempotent — safe to hit any time.

## Documentation

- `docs/REQUIREMENTS.html` / `.md` — original V0.1 requirements (pre-implementation).
- `docs/REQUIREMENTS_V2.html` — implementation snapshot: what shipped, what's planned, what's deferred.
- `docs/STAGE1.md` — original Phase 1 implementation notes.
- `CLAUDE.md` — architectural guide for any contributor (or AI assistant) working on the codebase.
