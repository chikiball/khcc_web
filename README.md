# khcc_web

**Knock House Chop Chop** — a fast-pace road cycling club. PWA for ride coordination.

## Stack

Next.js 15 (App Router) + TypeScript · Tailwind v4 · Supabase (Auth, Postgres, RLS, Storage) · `@ducanh2912/next-pwa` · Google OAuth.

## Local development

```bash
# 1. Install deps (Node 20+ required)
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL.

# 3. Push the schema to your Supabase project
#    (assumes Supabase CLI installed and `supabase login` already run)
npx supabase link --project-ref <your-project-ref>
npx supabase db push

# 4. Run dev server
npm run dev
# open http://localhost:3000
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Run built app on :3030 (the prod port behind nginx) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:diff` | Generate a new migration from local Supabase changes |
| `npm run db:types` | Regenerate `src/types/database.ts` from Supabase schema |

## Supabase Cloud setup (one-time)

1. Create a new project at https://supabase.com — copy the project ref, anon key, service role key into `.env.local`.
2. Push migrations: `npx supabase db push` (after linking).
3. **Google OAuth** — Authentication → Providers → Google:
   - Create OAuth credentials in Google Cloud Console.
   - Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Paste Client ID + Secret into Supabase.
4. **Auth URLs** — Authentication → URL Configuration:
   - Site URL: `https://khcc.nandharu.uk` (or `http://localhost:3000` for dev)
   - Redirect URLs: add both prod + local.

## Deployment (home server, temporary)

Target: `khcc.nandharu.uk`. Eventually moves to Vercel — see `docs/REQUIREMENTS.md` §8.

```bash
# On the home server, in the repo root:
cp .env.example .env  # fill in Supabase + site URL

# First time only — drop the nginx snippet into the upstream nginx conf.d/
sudo cp nginx/khcc.conf /etc/nginx/conf.d/khcc.conf
sudo nginx -t && sudo nginx -s reload

# Subsequent deploys
./scripts/deploy.sh
```

Full step-by-step setup is in `docs/STAGE1.md`.

## What's in here

- `src/app/` — App Router pages: `/`, `/login`, `/auth/callback`, `/onboarding`, `/rides`, `/rides/[id]`
- `src/lib/supabase/` — `client`, `server`, `middleware` — the standard `@supabase/ssr` setup
- `src/middleware.ts` — auth gate for `/rides` and `/onboarding`, redirects signed-in users away from `/login`
- `src/components/` — `google-sign-in`, `rsvp-button`, `ride-card`
- `supabase/migrations/` — schema (profiles, profiles_private, rides, ride_rsvps) with RLS on every table
- `supabase/seed.sql` — sample rides for local dev
- `public/gallery/` — landing-page photos (curated subset of `image_src/`)
- `docs/REQUIREMENTS.md` — full requirements (living doc)
- `docs/STAGE1.md` — what's in Stage 1 vs deferred
