# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What the project is

**KHCC Web** — a Progressive Web App for **Knock House Chop Chop** (cycling club). The "chop chop" identity drives UI tone: terse copy ("In" / "Out" / "Rolling" / "Done"), minimal-tap interactions, no chatty microcopy. Replaces WhatsApp + spreadsheets for ride coordination.

Stage 1 is shipped (code-complete). See `docs/STAGE1.md` for what's in Stage 1 vs deferred. Full requirements in `docs/REQUIREMENTS.md`.

## Commands

```bash
npm install            # Node 20+ required
npm run dev            # Next.js dev on :3000
npm run build          # production build
npm run start          # run built app on :3030 (the prod port behind nginx)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run db:generate    # drizzle-kit: generate SQL migration from schema.ts changes
npm run db:migrate     # drizzle-kit: apply pending migrations against DATABASE_URL
npm run db:push        # drizzle-kit: push schema directly (dev shortcut, no migration file)
npm run db:studio      # drizzle-kit: open the DB GUI
npx tsx scripts/seed.ts   # seed sample rides (idempotent — skips if non-empty)
```

Single test: no test runner wired up yet — add Vitest when the first test arrives (REQUIREMENTS NFR-24 targets ≥60% coverage on RSVP/waitlist/auth-guards).

## Architecture

**Stack — fully self-hosted, zero managed dependencies:** Next.js 15 App Router + TypeScript strict · Tailwind v4 (config in `src/app/globals.css` via `@theme`) · **Postgres 16 in Docker** · **Drizzle ORM** for queries + migrations · **Auth.js v5 (NextAuth)** with Google OAuth provider + Drizzle adapter, JWT session strategy · `@ducanh2912/next-pwa`. No Supabase, no Vercel, no Resend, no third-party identity service.

**Auth flow:** `/login` → Auth.js `signIn("google", { callbackUrl })` → Google → `/api/auth/callback/google` (Auth.js handles) → middleware sees the session and routes:
- new user (`onboardedAt` is null) → `/onboarding`
- existing user → `/rides`

The session JWT carries `id`, `role`, and `onboarded` — refreshed from the DB on every JWT callback so role promotions and onboarding completion propagate without re-login. **Don't read role from the JWT for security-critical decisions in long-running requests** — always fetch the latest from `users` table when you mutate.

**Auth helpers — use these, don't roll your own:**
- `getCurrentUser()` returns the session user or null
- `requireUser()` redirects to `/login` if not signed in
- `requireAdmin()` redirects to `/rides` if not admin
- `canManageRides(role)` for `leader | organiser | admin` checks

All in `src/lib/auth-helpers.ts`.

**Authorization model — application-level, not RLS.** Postgres has RLS but it's not used because we don't have a managed auth context (Supabase's `auth.uid()`) to key off. Every Server Action / Server Component that touches user data calls `requireUser()` first and scopes queries by `user.id`. The two non-obvious rules:

1. **Emergency contact lives in `users_private`**, separate from `users`. Any query against `users` cannot leak it. The only place that should join or select from `users_private` is an explicit "is admin or is the row owner" check. Never widen this.
2. **Mutations that change someone else's data** (e.g. an admin promoting a user, a leader cancelling a ride) must re-check role from the DB at action time — don't trust the session JWT for these.

**Drizzle conventions:**
- Schema is the source of truth: `src/db/schema.ts`. Don't hand-write migrations.
- After changing schema: `npm run db:generate` produces a SQL file in `drizzle/`. Commit it.
- The Docker entrypoint runs `drizzle-kit migrate` before Next.js starts — production migrations are automatic on deploy. Local dev uses `npm run db:push` for fast iteration.
- Single shared pool in `src/db/index.ts`. Don't `new Pool()` anywhere else.

**Brand & UI conventions** (derived from team kit photos in `image_src/`):
- Palette in `src/app/globals.css` `@theme` block — coral pink `coral-*`, deep maroon `maroon-*`, coral red `flash-*`, cream `cream-*`. Use the semantic aliases (`brand`, `ink`, `paper`) where possible.
- Display font: Bricolage Grotesque (headings). Body: Inter.
- Hex-badge motif via `.hex-clip` clip-path — recurring shape for KHCC logo, pace badges, app icon.
- Pace group is **never colour-only** (NFR-6) — `<PaceBadge>` always renders the letter.
- Tap targets ≥ 44px enforced via global `button { min-height: 44px }` (gloves — NFR-5).

**Deployment.** `khcc.nandharu.uk` on the home server. Two containers on the external `server-net` Docker network: `khcc-db` (Postgres 16, named volume `khcc_db_data`) and `khcc-web` (Next.js standalone build). Reverse-proxied by an upstream nginx via `nginx/khcc.conf`. Migrations run automatically on container start via `docker/entrypoint.sh` before Next.js boots. Deploy with `scripts/deploy.sh`.

**Build-time vs runtime env.** Auth.js secrets, DB URL, Google client secret are runtime-only — never baked into the image. `NEXT_PUBLIC_SITE_URL` and `AUTH_GOOGLE_ID` (the public ID is fine to expose) are passed as build args because the Auth.js client uses them in browser bundles.

## Cross-cutting constraints (still apply from REQUIREMENTS)

- Mobile-first 375px min width; gloves-friendly 44pt tap targets.
- WCAG 2.1 AA, `prefers-reduced-motion` respected (already in globals.css).
- Times stored UTC, displayed in member's local tz. Metric units default.
- i18n-ready: prefer translation keys to hard-coded strings even though English is the only launch language.
- TypeScript strict mode mandated.

## Don't

- Don't reach for a managed service (Supabase, Vercel KV, Clerk, Auth0, Resend) — the explicit goal is zero managed dependencies.
- Don't add features from REQUIREMENTS Phase 2/3 (trips, Strava, races, leaderboard, live safety, incidents) into Stage 1 — they're deliberately deferred.
- Don't hand-write SQL migrations. Edit `src/db/schema.ts` and run `npm run db:generate`.
- Don't read emergency contact except through an explicit admin-or-self check that joins `users_private`.
- Don't put `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, or `POSTGRES_PASSWORD` into Dockerfile `ARG` — they're runtime env only.
