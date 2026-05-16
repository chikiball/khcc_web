# KHCC Web — Requirements Document

**Version:** 0.1 (Draft)
**Last updated:** 2026-05-11
**Owner:** KHCC Committee
**Status:** Draft for review

---

## 1. Overview

### 1.1 Purpose
KHCC Web is a Progressive Web App (PWA) for **KHCC**, a road-cycling club. It replaces the current patchwork of WhatsApp messages, spreadsheets, and shared documents with a single source of truth for rides, overseas trips, races, and club communication.

### 1.2 Scope
This document defines the functional and non-functional requirements for the MVP and its two follow-on phases. It is a **living document** — update as features ship.

### 1.3 Out of Scope (for now)
- Native iOS/Android apps (PWA only; native is a future consideration).
- Payment processing beyond deposit tracking (use Stripe/PayNow externally for Phase 1).
- Full training-plan coaching tools (link out to TrainingPeaks/Strava instead).
- E-commerce (kit shop) — backlog only.

---

## 2. Goals & Success Metrics

| Goal | Metric | Target (6 months post-launch) |
|---|---|---|
| Replace WhatsApp for ride coordination | % of weekly rides created & RSVP'd in-app | ≥ 80% |
| Reduce ride-leader admin time | Self-reported time/week per leader | < 15 min (from ~1 hr) |
| Lower barrier for new members | New-member 1st-ride within 30 days of signup | ≥ 50% |
| Retain members | Monthly active members / total members | ≥ 70% |
| Build club archive | Rides logged with photos/route | ≥ 60% |

---

## 3. User Personas

### 3.1 Priya — The Regular (primary)
Rides 2–3× a week, mid-pace (B group). Checks her phone the night before and morning-of. Wants to know: *Is the ride on? Who's coming? Where do we meet?*

### 3.2 Wei — The Ride Leader
Organises the Saturday bunch. Currently spends an hour each week copy-pasting ride details into WhatsApp. Needs tools to create recurring rides, cancel on weather, track RSVPs, and know who's actually showing up.

### 3.3 Arun — The New Member
Just joined. Unsure which pace group he fits. Nervous about etiquette. Wants a gentle on-ramp: no-drop rides, clear meet points, visible faces of who's going.

### 3.4 Mei — The Racer / Trip Regular
Joins club races and overseas trips. Needs trip itineraries, cost breakdowns, race registration reminders, and results tracking.

### 3.5 Kumar — The Committee/Admin
Manages club membership, announcements, finances for trips. Needs member directory, roles, and oversight dashboards.

---

## 4. User Roles & Permissions

| Role | Permissions |
|---|---|
| **Guest** (not signed in) | View public landing, join-us info, club overview. |
| **Member** | RSVP to rides, view member directory, create profile, sign up for trips/races, post photos. |
| **Ride Leader** | All Member permissions + create/edit/cancel rides, manage RSVPs, post ride-specific announcements. |
| **Trip Organiser** | All Member permissions + create/edit trips, manage signup status, upload trip documents. |
| **Admin** | All permissions + manage members, assign roles, post club-wide announcements, edit club settings. |

Role assignments are set in the Admin area. A single user may hold multiple roles.

---

## 5. Functional Requirements

### 5.1 Phase 1 — MVP

#### FR-1: Authentication & Onboarding
- **FR-1.1** Users sign up/sign in via Google. *(Stage 1: Google only. Email magic link and Apple deferred.)*
- **FR-1.2** New signups complete a profile (name, photo, pace group, bike, Strava handle, emergency contact) before accessing member features.
- **FR-1.3** Admins can invite new members via email and pre-assign roles. *(Deferred past Stage 1.)*
- **FR-1.4** Password-less auth; sessions persist across devices.

**Acceptance:** A new user can go from landing page → signed in → completed profile in under 3 minutes on mobile.

#### FR-2: Ride Calendar
- **FR-2.1** Display upcoming rides in a scrollable list (default: next 14 days), sorted by date.
- **FR-2.2** Each ride card shows: date/time, ride title, start point, distance, elevation, pace group, rider count, 3 rider avatars + overflow count.
- **FR-2.3** Filter by: pace group (A/B/C), no-drop only, date range.
- **FR-2.4** Ride detail page shows: full description, embedded map (start pin), route link, full RSVP list, leader contact, weather forecast (Phase 1.5).
- **FR-2.5** Rides can be created one-off OR as recurring series (e.g. "Every Saturday 5:45 AM").
- **FR-2.6** Ride status: `scheduled`, `weather-watch`, `cancelled`, `completed`.

**Acceptance:** A member can find and RSVP to the next ride matching their pace in ≤ 3 taps from the home screen.

#### FR-3: RSVP System
- **FR-3.1** Members tap "I'm In" to RSVP. One tap to confirm, one tap to withdraw.
- **FR-3.2** Rides may be capped; over-cap RSVPs go to an automatic waitlist.
- **FR-3.3** Waitlist promotes in FIFO order when someone withdraws.
- **FR-3.4** RSVP cutoff: editable by leader (default: ride start time).
- **FR-3.5** Members see their own RSVPs in a "My Rides" view.

**Acceptance:** RSVP state syncs in real time across devices within 2 seconds.

#### FR-4: Member Profiles & Directory
- **FR-4.1** Each member has a profile: photo, display name, pace group, bike(s), Strava link, bio, join date.
- **FR-4.2** Emergency contact is private — visible only to Admins and the Ride Leader of a ride the member is RSVP'd to.
- **FR-4.3** Directory: searchable/filterable list of members (by name, pace group).
- **FR-4.4** Privacy toggles: members can hide full name / hide from directory.

**Acceptance:** Emergency contact is never exposed to non-authorised roles in any API response.

#### FR-5: Ride Leader Tools
- **FR-5.1** Create ride form: title, date/time, start point (map picker), distance, elevation, pace group, route URL, description, cap, tags.
- **FR-5.2** Edit / cancel ride. Cancellation prompts reason (weather / route change / other) and auto-notifies RSVP'd riders.
- **FR-5.3** View RSVP list with contact info for RSVP'd members.
- **FR-5.4** Post ride-specific announcement (e.g. "Meet point moved 200m north").

**Acceptance:** A leader can create a recurring Saturday ride series in under 2 minutes.

#### FR-6: Announcements
- **FR-6.1** Club-wide announcements feed on the home screen.
- **FR-6.2** Pinned announcements appear at the top.
- **FR-6.3** Admins/leaders can post; members can react (👍❤️).
- **FR-6.4** Push notifications via web push (optional opt-in).

**Acceptance:** A pinned announcement is visible to all signed-in members on their next app open.

#### FR-7: Notifications
- **FR-7.1** Email reminders: 24h before ride for RSVP'd riders; ride cancellation immediate.
- **FR-7.2** Web push (opt-in): new ride posted matching your pace group; your ride cancelled; waitlist promotion.
- **FR-7.3** In-app notifications bell with unread count.

---

### 5.2 Phase 2 — Trips & Strava

#### FR-8: Overseas Trips
- **FR-8.1** Trip page: title, destination, start/end dates, cover image, description, daily itinerary (with routes), hotel info, flights summary, packing list, cost breakdown.
- **FR-8.2** Signup flow: `Interested` → `Deposit Paid` → `Confirmed` → `Cancelled`.
- **FR-8.3** Roommate/pairing preferences form.
- **FR-8.4** Document vault per trip: PDFs (insurance, visa info, bike box specs).
- **FR-8.5** Post-trip gallery: photos + aggregated ride stats.
- **FR-8.6** Signup status is managed by the Trip Organiser manually (deposit tracked externally).

#### FR-9: Strava Integration
- **FR-9.1** Members connect Strava via OAuth from profile.
- **FR-9.2** Auto-import activities (rides only) tagged to KHCC rides when date/time matches (± 1 hour).
- **FR-9.3** Weekly club mileage leaderboard (opt-out available).
- **FR-9.4** KOM/QOM shoutouts in the announcements feed (auto-generated, admin-approved).
- **FR-9.5** Handle Strava token refresh and revocation gracefully.

---

### 5.3 Phase 3 — Racing, Safety & Stats

#### FR-10: Race Calendar
- **FR-10.1** List of upcoming races (local + overseas): name, date, location, category, distance, registration deadline, external registration URL.
- **FR-10.2** Members can indicate "I'm racing this" and their category.
- **FR-10.3** Club team view per race: who's in, which category.
- **FR-10.4** Post-race results entry: time, position, notes. Admin-verified.

#### FR-11: Season Leaderboard
- **FR-11.1** Configurable points system (e.g. podium finishes, participation).
- **FR-11.2** Season-long leaderboard visible to all members.

#### FR-12: Live Ride Safety
- **FR-12.1** Ride check-in: members tap "Rolling" at ride start and "Safe Home" when finished.
- **FR-12.2** Ride Leader dashboard shows live check-in status during the ride.
- **FR-12.3** Overdue alert: if a rider hasn't checked in "Safe Home" 1h after expected finish, leader gets notified.

#### FR-13: Incident Reporting
- **FR-13.1** Members can report incidents: crash / near-miss / mechanical / hazard.
- **FR-13.2** Incidents attached to a ride (if applicable) and geotagged.
- **FR-13.3** Admin-only heatmap of incidents to inform route choices.

#### FR-14: Club Stats Dashboard
- **FR-14.1** Club totals: km ridden, elevation, rides completed, active members (this week/month/year/all-time).
- **FR-14.2** Individual attendance streaks.

---

## 6. Non-Functional Requirements

### 6.1 Performance
- **NFR-1** First Contentful Paint ≤ 1.5s on 4G, ≤ 3s on 3G (home page).
- **NFR-2** Time to Interactive ≤ 3s on mid-range Android.
- **NFR-3** API p95 response time ≤ 400ms for reads, ≤ 800ms for writes.

### 6.2 Accessibility
- **NFR-4** WCAG 2.1 AA compliance (contrast, focus, keyboard nav, screen-reader labels).
- **NFR-5** Min tap target 44×44pt (gloves!).
- **NFR-6** Pace group never conveyed by colour alone (always includes letter A/B/C).
- **NFR-7** Respect `prefers-reduced-motion`.

### 6.3 Responsive & Device Support
- **NFR-8** Mobile-first; designs target 375px min width.
- **NFR-9** Support: iOS Safari 16+, Chrome 110+, Firefox 110+, Edge 110+.
- **NFR-10** PWA: installable on iOS/Android, offline cache for upcoming ride list.

### 6.4 Security & Privacy
- **NFR-11** All traffic over HTTPS/TLS 1.2+.
- **NFR-12** Auth via Supabase Auth (password-less, OAuth). No plaintext passwords stored.
- **NFR-13** Row-Level Security (RLS) on all Postgres tables. Emergency contact visible only to authorised roles.
- **NFR-14** PDPA-aligned: members can export and delete their data on request.
- **NFR-15** Strava tokens encrypted at rest.
- **NFR-16** Audit log for admin actions (role changes, ride cancellations, member removals).

### 6.5 Reliability
- **NFR-17** Target uptime: 99.5% (excluding planned maintenance).
- **NFR-18** Daily database backups, 30-day retention.
- **NFR-19** Graceful degradation when Strava/Mapbox/OpenWeather are unavailable.

### 6.6 Internationalisation
- **NFR-20** English only at launch. Structure code for i18n (keys, not hard-coded strings) to ease Phase 3+ translation.
- **NFR-21** Dates/times displayed in the member's local timezone; times stored as UTC.
- **NFR-22** Units: metric by default (km, m); imperial toggle optional in Phase 3.

### 6.7 Maintainability
- **NFR-23** TypeScript strict mode.
- **NFR-24** Unit test coverage ≥ 60% on core domain logic (RSVP, waitlist, auth guards).
- **NFR-25** All PRs pass lint + typecheck + tests before merge.
- **NFR-26** Component library via Storybook (Phase 2).

---

## 7. Data Model (Summary)

High-level entities — full schema in `docs/SCHEMA.md` (TBD):

- **users** — id, email, profile, pace_group, role, strava_id, emergency_contact (private)
- **rides** — id, title, starts_at, start_point (geo), distance_km, elevation_m, pace_group, route_url, leader_id, status, cap
- **ride_rsvps** — ride_id, user_id, status (in / waitlist / cancelled), created_at
- **ride_recurrences** — parent ride, RRULE, end_date
- **trips** — id, title, dates, destination, cost, cover_image, organiser_id
- **trip_signups** — trip_id, user_id, status, roommate_pref, notes
- **trip_documents** — trip_id, file_url, category
- **races** — id, name, date, location, category, registration_url, deadline
- **race_entries** — race_id, user_id, category, result
- **announcements** — id, title, body, author_id, pinned, audience (club / ride / trip)
- **incidents** — id, ride_id (nullable), reporter_id, type, location (geo), notes
- **strava_activities** — id, user_id, activity_id, distance, elevation, moving_time, started_at
- **check_ins** — ride_id, user_id, rolling_at, safe_home_at

---

## 8. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | SSR, strong DX, Vercel-native |
| UI | Tailwind CSS v4 + shadcn/ui (when needed) | Fast iteration, accessible primitives |
| Database & Auth | Supabase (Postgres, Auth, Storage, Realtime) | Single managed backend, RLS built-in |
| Maps | Mapbox GL (or Leaflet fallback) | GPX rendering, offline tile option *(deferred past Stage 1)* |
| External APIs | Strava, OpenWeather, Resend | Core integrations *(deferred past Stage 1)* |
| Hosting | **Stage 1: home server (`khcc.nandharu.uk`)** behind nginx → Vercel later | Temporary self-host while shaping the app; move to Vercel before scaling |
| PWA | `@ducanh2912/next-pwa` | Offline caching, installable (maintained fork of `next-pwa`) |
| Analytics | PostHog (self-hosted option) | Privacy-friendly usage insights *(deferred past Stage 1)* |

---

## 9. Release Plan

### Milestone 1 — MVP (weeks 1–6)
FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7. Closed beta with 10 core members.

### Milestone 2 — Public Launch (week 7)
Onboard full club. Collect feedback. Bugfix sprint.

### Milestone 3 — Phase 2 (weeks 8–14)
FR-8 (Trips), FR-9 (Strava).

### Milestone 4 — Phase 3 (weeks 15–22)
FR-10, FR-11, FR-12, FR-13, FR-14.

### Ongoing
Kit shop, bike garage, coffee-stop reviews, dark mode, multi-language.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Low adoption — members stay on WhatsApp | Medium | High | Committee champions; WhatsApp bot posts ride links back; onboarding session |
| Strava API rate limits | Medium | Medium | Cache aggressively; batch sync; token refresh handling |
| Ride leader doesn't update cancellations in-app | High | High | Multi-channel notifications; admin can cancel on leader's behalf |
| Privacy concerns (emergency contacts, location) | Medium | High | Strict RLS, explicit consent, PDPA compliance doc |
| Scope creep (kit shop, coaching, etc.) | High | Medium | Strict phase gating; backlog board for deferred ideas |
| Single maintainer burnout | Medium | High | Document everything; seek a second contributor early |

---

## 11. Open Questions

1. **Club branding** — ~~is `#E63946` red correct~~ Brand colours derived from team kit photos: coral pink `#EC6E8A`, deep maroon `#3D1620`, coral red accent `#FF5B3F`, cream `#F4ECE0`. Hex-badge motif (KHCC sleeve patch) re-used across the UI. *(Resolved 2026-05-16.)*
2. **Club name** — ~~does "KHCC" have a full expansion~~ KHCC = **Knock House Chop Chop**. "Chop chop" = quick / fast. *(Resolved 2026-05-16.)*
3. **Geography** — primary ride region (Singapore? Malaysia? SEA?) — affects timezone, weather provider, map defaults.
4. **Membership model** — open signup, or invite-only by admin?
5. **Payments** — any appetite to integrate Stripe/PayNow for trip deposits in Phase 2, or keep external?
6. **Data residency** — any requirement to host in a specific region?
7. **Ride capping norms** — do rides typically have caps, or is it open participation?
8. **WhatsApp bridging** — should we build a bot that posts new rides to the WhatsApp group?

---

## 12. Appendix

- **Design Language:** `docs/STYLE.html`
- **Roadmap:** `docs/ROADMAP.md` (TBD)
- **Database Schema:** `docs/SCHEMA.md` (TBD)
- **API Contract:** `docs/API.md` (TBD)

---

*This requirements doc is a living document. Changes should be tracked via PRs and reviewed by the committee.*
