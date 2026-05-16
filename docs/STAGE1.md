# Stage 1 — what shipped, what's next

**Status:** Code scaffolded 2026-05-16. Not yet deployed; awaiting Supabase project + Google OAuth credentials.

## What's in Stage 1

| Surface | Notes |
|---|---|
| Public landing (`/`) | Hero, gallery strip from 6 jersey photos, "what is KHCC", sign-in CTA. Redirects signed-in users to `/rides`. |
| Sign in (`/login`) | Google OAuth only (FR-1.1 trimmed — no Apple, no email magic link in Stage 1). |
| OAuth callback (`/auth/callback`) | Exchanges code for session, routes to `/onboarding` (if profile incomplete) or `/rides`. |
| Onboarding (`/onboarding`) | Display name, pace group A/B/C, bike, Strava handle, emergency contact (private). Marks `profiles.onboarded_at`. |
| Ride list (`/rides`) | Next 14 days, cards with pace badge + RSVP count + RSVP toggle. Read-only — admins seed rides via SQL or Supabase Studio. |
| Ride detail (`/rides/[id]`) | Date/time, distance, elevation, description, route link, full RSVP list with avatars, sticky RSVP bar. |
| RSVP toggle | One tap In/Out via server action. No cap, no waitlist. |
| PWA shell | `manifest.json`, hex-badge SVG icon, `next-pwa` service worker (prod only). |

## Schema (Supabase Postgres)

- `profiles` — public-ish member info (RLS: any authenticated read; own write)
- `profiles_private` — emergency contact, locked to self + admin (RLS)
- `rides` — read by all members; write by `leader`/`organiser`/`admin` only (RLS)
- `ride_rsvps` — read by all members; insert/update/delete own row (RLS)
- `handle_new_user` trigger — auto-creates profiles + profiles_private on Google signup with sensible defaults (pace_group='B', display_name from Google `full_name`)

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
- FR-5 Ride leader self-serve create / edit / cancel UI (admin seeds via Supabase Studio in Stage 1)
- FR-6 Announcements feed
- FR-7 Email reminders + web push + in-app notifications bell

Also deferred to Stage 1.5:

- Generate PNG icons from `public/icon.svg` (see `public/icons-todo.md`)
- Wire up nginx + systemd/pm2 on home server for `khcc.nandharu.uk`
- Make ride leader for emergency-contact-access security-definer function
- `src/types/database.ts` regen after first prod migration push

## Known small issues

- `npm install` could not complete in the scaffolding sandbox (npm registry returned 403). Run `npm install` locally before first `npm run dev`.
- PNG manifest icons are not yet generated — the SVG icon works as a fallback in modern browsers but iOS/Android home-screen install prefers PNGs. Generate via `rsvg-convert` or `magick` per `public/icons-todo.md`.

## Home-server deploy walkthrough (`khcc.nandharu.uk`)

This mirrors the `learning_buddy` (`sora.nandharu.uk`) pattern: each app lives in its own repo, joins the external `server-net` Docker network, and is reverse-proxied by an upstream nginx that also fronts other `*.nandharu.uk` subdomains.

### Prerequisites on the home server

- Docker + `docker compose` plugin
- The `server-net` external network already exists (created when `learning_buddy` was set up): verify with `docker network ls | grep server-net`
- An upstream nginx with a `conf.d/` directory loaded into the proxy (same one that serves `sora.nandharu.uk`)
- DNS: A record for `khcc.nandharu.uk` → home server IP (or via Cloudflare proxy, like the others)

### Step 1 — Supabase Cloud project

Before anything on the server, create the Supabase project so you have keys to drop into `.env`:

1. https://supabase.com → New project → pick a region close to the club (e.g. Singapore)
2. Settings → API → copy `Project URL`, `anon public` key, `service_role` key
3. Authentication → Providers → Google → enable, paste credentials from Google Cloud Console (OAuth client with redirect `https://<project-ref>.supabase.co/auth/v1/callback`)
4. Authentication → URL Configuration:
   - Site URL: `https://khcc.nandharu.uk`
   - Redirect URLs: add `https://khcc.nandharu.uk/**` and `http://localhost:3000/**`
5. From your local machine: `npx supabase link --project-ref <ref>` then `npx supabase db push` to apply `supabase/migrations/20260516000001_initial_schema.sql`

### Step 2 — Clone and configure on the server

```bash
ssh you@home-server
cd /var/www                      # or wherever you keep the *.nandharu.uk repos
git clone <this-repo-url> khcc_web
cd khcc_web

cp .env.example .env
nano .env                        # paste the Supabase values
                                 # set NEXT_PUBLIC_SITE_URL=https://khcc.nandharu.uk
```

`.env` should contain:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=https://khcc.nandharu.uk
```

### Step 3 — Wire up nginx (one-time)

Drop the snippet into the upstream nginx config directory (the one already serving the other `*.nandharu.uk` subdomains):

```bash
sudo cp nginx/khcc.conf /etc/nginx/conf.d/khcc.conf
sudo nginx -t                   # syntax check
sudo nginx -s reload
```

If the upstream nginx runs as a Docker container, copy the snippet into whatever bind-mount feeds it (varies by setup) and reload that container instead.

The conf assumes TLS is terminated upstream (Cloudflare or an L7 proxy), matching how `learning_buddy.conf` works. If you need TLS termination on this nginx, add a `listen 443 ssl;` block with cert paths.

### Step 4 — First deploy

```bash
./scripts/deploy.sh
```

The script:
1. `git pull origin main`
2. `docker compose build khcc-web` — bakes `NEXT_PUBLIC_*` from `.env` into the bundle
3. `docker compose up -d khcc-web` — starts the container on `server-net`
4. Polls the healthcheck for up to 60s

When it reports `healthy`, hit `https://khcc.nandharu.uk` from a browser.

### Step 5 — Bootstrap your first admin

After you sign in once via Google, your row exists in `auth.users` and (via the `handle_new_user` trigger) in `public.profiles`. Promote yourself in the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where id = '<your-user-id>';
```

You can find your user id under Authentication → Users. Now you can seed rides directly via the Table Editor (or via SQL using `supabase/seed.sql` as a template).

### Subsequent deploys

```bash
ssh you@home-server
cd /var/www/khcc_web
./scripts/deploy.sh
```

If you change `nginx/khcc.conf`, copy it again and reload nginx.

If you change a `NEXT_PUBLIC_*` value in `.env`, you must rebuild — `deploy.sh` does that automatically. If you only change a server-only secret (`SUPABASE_SERVICE_ROLE_KEY`), `docker compose up -d khcc-web` is enough; no rebuild needed.

### Troubleshooting

- **502 from nginx** — container not running or not on `server-net`. `docker compose ps` and `docker network inspect server-net | grep khcc-web`.
- **Healthcheck stuck on `starting`** — `docker logs khcc-web -f` to watch the Next.js boot. Cold start is usually 5–15s.
- **`NEXT_PUBLIC_*` undefined in browser** — you ran `docker compose up` without rebuilding after changing `.env`. Run `docker compose build khcc-web --no-cache` then `up -d`.
- **OAuth redirect loops** — site URL / redirect URLs in Supabase don't match what the browser is hitting. Recheck Step 1.4.

## Open product questions still unresolved

(From REQUIREMENTS §11 — not blocking Stage 1, will block later stages):

- Primary ride region (timezone, weather provider, map centre)
- Membership model — open signup vs invite-only
- Ride capping norms (drives waitlist UX in Stage 2)
- WhatsApp bridging bot
