# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What the project is

**KHCC Web** — a Progressive Web App for **Knock House Chop Chop** (cycling club). The "chop chop" identity drives UI tone: terse copy ("In" / "Out" / "Rolling" / "Done"), minimal-tap interactions, no chatty microcopy. Replaces WhatsApp + spreadsheets for ride coordination.

Stage 1 is shipped (code-complete; awaiting Supabase project + Google OAuth credentials before first deploy). See `docs/STAGE1.md` for what's in Stage 1 vs deferred. Full requirements in `docs/REQUIREMENTS.md`.

## Commands

```bash
npm install            # Node 20+ required
npm run dev            # Next.js dev on :3000
npm run build          # production build
npm run start          # run built app on :3030 (the prod port behind nginx)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run db:diff        # generate migration from local Supabase changes
npm run db:types       # regenerate src/types/database.ts from schema
```

Single test: no test runner wired up yet — add Vitest when the first test arrives (REQUIREMENTS NFR-24 targets ≥60% coverage on RSVP/waitlist/auth-guards).

Supabase Cloud setup steps (one-time, per environment) live in `README.md`.

## Architecture

**Stack:** Next.js 15 App Router + TypeScript strict · Tailwind v4 (config in `src/app/globals.css` via `@theme`) · Supabase (Auth + Postgres + RLS + Storage) · `@ducanh2912/next-pwa` · Google OAuth.

**Auth flow:** `/login` → Google OAuth → `/auth/callback` (exchange code for session) → either `/onboarding` (if `profiles.onboarded_at` is null) or `/rides`. The middleware (`src/middleware.ts` → `src/lib/supabase/middleware.ts`) gates `/rides` and `/onboarding`, refreshes the session cookie on every request, and bounces signed-in users away from `/login`. **Never remove the `getUser()` call in `updateSession`** — it's what keeps the session cookie fresh.

**Three Supabase clients, three contexts:**
- `src/lib/supabase/client.ts` — browser components (`"use client"`)
- `src/lib/supabase/server.ts` — Server Components, Route Handlers, Server Actions (`await createClient()`)
- `src/lib/supabase/middleware.ts` — Edge middleware only

Mixing them up causes auth-cookie bugs that look like "user is null at random". Stick to the right client per context.

**Authorization model — RLS-first.** Every table has RLS enabled. `profiles` is broadly readable; `profiles_private` (emergency contact) is locked to self + admin. `rides` write is `leader`/`organiser`/`admin` only. `ride_rsvps` is "own row only" for write. **Do not add a table without an RLS policy.** Server Actions and Route Handlers should still rely on RLS to fail closed — never use the service role key in user-facing code paths.

**Privacy split.** Emergency contact lives in `profiles_private`, not `profiles`, so RLS can keep it simple. When a future stage needs ride leaders to see a rider's emergency contact, add a `security definer` function (`get_emergency_contact(rider_id)`) that checks "am I the leader of a ride this user is RSVP'd to?" — don't try to express that in raw RLS, and don't denormalise the field back into `profiles`.

**Auto-profile on signup.** The `handle_new_user` trigger inserts `profiles` + `profiles_private` rows whenever `auth.users` gets a new row, with `pace_group='B'` as a default. Onboarding then UPDATES (not INSERTs) and stamps `onboarded_at`. Don't try to create profiles client-side.

**Brand & UI conventions** (derived from team kit photos in `image_src/`):
- Palette in `src/app/globals.css` `@theme` block — coral pink `coral-*`, deep maroon `maroon-*`, coral red `flash-*`, cream `cream-*`. Use the semantic aliases (`brand`, `ink`, `paper`) where possible.
- Display font: Bricolage Grotesque (headings). Body: Inter.
- Hex-badge motif via `.hex-clip` clip-path — recurring shape for KHCC logo, pace badges, app icon.
- Pace group is **never colour-only** (NFR-6) — `<PaceBadge>` always renders the letter.
- Tap targets ≥ 44px enforced via global `button { min-height: 44px }` (gloves — NFR-5).

**Deployment.** `khcc.nandharu.uk` on home server is the *temporary* target (Stage 1). The plan is to move to Vercel later. Container build via `Dockerfile` (multi-stage, Next.js `output: "standalone"`); orchestration via `docker-compose.yml` on the external `server-net` network; reverse-proxied by an upstream nginx via `nginx/khcc.conf`. Deploy with `scripts/deploy.sh`. **`NEXT_PUBLIC_*` env vars are baked into client bundles at build time** — they're passed as `args:` in `docker-compose.yml` and as `ARG` in the Dockerfile builder stage. Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`) are runtime-only and stay out of the image.

## Cross-cutting constraints (still apply from REQUIREMENTS)

- Mobile-first 375px min width; gloves-friendly 44pt tap targets.
- WCAG 2.1 AA, `prefers-reduced-motion` respected (already in globals.css).
- Times stored UTC, displayed in member's local tz. Metric units default.
- i18n-ready: prefer translation keys to hard-coded strings even though English is the only launch language.
- TypeScript strict mode mandated.

## Don't

- Don't propose Vercel/Mapbox/Resend before they're needed — Stage 1 has none of them. Add when scope demands.
- Don't add features from REQUIREMENTS Phase 2/3 (trips, Strava, races, leaderboard, live safety, incidents) into Stage 1 — they're deliberately deferred.
- Don't replace `@supabase/ssr` with the raw `@supabase/supabase-js` client in components — the SSR package handles cookie sync.
- Don't expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. It's server-only, intended for admin scripts.
