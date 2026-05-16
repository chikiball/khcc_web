-- KHCC Web — initial schema
-- Stage 1: profiles + rides + rsvps. RLS on every table.
-- Run via Supabase CLI: `supabase db reset` (local) or push to Cloud via migration.

-- ========================================================================
-- HELPERS
-- ========================================================================

-- updated_at trigger function (reused on every table that needs it)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ========================================================================
-- PROFILES (public-ish member info)
-- ========================================================================
-- One row per auth.users. Auto-created on signup via the handle_new_user trigger.
-- Emergency contact lives in profiles_private (separate table) so RLS can lock it
-- down without complex column-level rules.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  pace_group text not null check (pace_group in ('A', 'B', 'C')),
  bike text,
  strava_handle text,
  bio text,
  role text not null default 'member' check (role in ('member', 'leader', 'organiser', 'admin')),
  hide_from_directory boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Any authenticated member can read profiles (directory view)
create policy "profiles: members can read"
  on public.profiles for select
  to authenticated
  using (true);

-- Members can insert/update only their own profile
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ========================================================================
-- PROFILES_PRIVATE (emergency contact — admin/self only)
-- ========================================================================
-- Stored separately so RLS is straightforward: own row OR admin.
-- A future stage will add a security-definer function for ride leaders to
-- look up emergency contacts of riders RSVP'd to their ride.

create table public.profiles_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  emergency_contact_name text,
  emergency_contact_phone text,
  updated_at timestamptz not null default now()
);

create trigger profiles_private_set_updated_at
  before update on public.profiles_private
  for each row execute function public.set_updated_at();

alter table public.profiles_private enable row level security;

create policy "profiles_private: read own or admin"
  on public.profiles_private for select
  to authenticated
  using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "profiles_private: insert own"
  on public.profiles_private for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_private: update own or admin"
  on public.profiles_private for update
  to authenticated
  using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ========================================================================
-- RIDES
-- ========================================================================

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  start_point_name text not null,
  start_point_lat numeric,
  start_point_lng numeric,
  distance_km numeric,
  elevation_m numeric,
  pace_group text not null check (pace_group in ('A', 'B', 'C')),
  route_url text,
  description text,
  leader_id uuid references public.profiles(id) on delete set null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'weather-watch', 'cancelled', 'completed')),
  cap int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rides_starts_at_idx on public.rides(starts_at);
create index rides_status_idx on public.rides(status);

create trigger rides_set_updated_at
  before update on public.rides
  for each row execute function public.set_updated_at();

alter table public.rides enable row level security;

create policy "rides: members can read"
  on public.rides for select
  to authenticated
  using (true);

create policy "rides: leaders+ can write"
  on public.rides for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('leader', 'organiser', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('leader', 'organiser', 'admin')
    )
  );

-- ========================================================================
-- RIDE_RSVPS
-- ========================================================================

create table public.ride_rsvps (
  ride_id uuid not null references public.rides(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in' check (status in ('in', 'waitlist', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ride_id, user_id)
);

create index ride_rsvps_user_id_idx on public.ride_rsvps(user_id);

create trigger ride_rsvps_set_updated_at
  before update on public.ride_rsvps
  for each row execute function public.set_updated_at();

alter table public.ride_rsvps enable row level security;

create policy "ride_rsvps: members can read"
  on public.ride_rsvps for select
  to authenticated
  using (true);

create policy "ride_rsvps: insert own"
  on public.ride_rsvps for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ride_rsvps: update own"
  on public.ride_rsvps for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ride_rsvps: delete own"
  on public.ride_rsvps for delete
  to authenticated
  using (auth.uid() = user_id);

-- ========================================================================
-- AUTH SIGNUP HOOK
-- ========================================================================
-- When a new auth.users row is created (via Google OAuth), insert a stub
-- profiles row. The user fills out the rest in /onboarding and we mark
-- onboarded_at on completion.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, pace_group)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'B'  -- default until onboarding picks one
  );

  insert into public.profiles_private (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
