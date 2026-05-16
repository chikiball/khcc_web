# khcc_web

**Knock House Chop Chop** — a fast-pace road cycling club. PWA for ride coordination.

Fully self-hosted, zero managed dependencies. Postgres + Auth.js + Next.js, all in Docker on a home server.

## Stack

Next.js 15 (App Router) + TypeScript · Tailwind v4 · **Postgres 16 in Docker** · **Drizzle ORM** · **Auth.js v5** (Google OAuth) · `@ducanh2912/next-pwa`.

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

Full step-by-step setup is in `docs/STAGE1.md`.
