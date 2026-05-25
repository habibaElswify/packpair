-- PackPair schema — tables, helpers, and the new-user trigger.
-- Apply in the Supabase SQL editor (or `supabase db push`). See supabase/README.md.

-- ─────────────────────────── helpers ───────────────────────────

create or replace function public.is_uw_email(addr text)
returns boolean language sql immutable as $$
  select addr ilike '%@uw.edu'
$$;

-- ─────────────────────────── profiles ───────────────────────────
-- One row per signed-in user, mirroring auth.users. Identity only.

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  full_name    text,
  is_app_admin boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── canvas links ───────────────────────────
-- A user's own Canvas access, used to read THEIR enrollments (teacher
-- verification) and to import a roster. Owner-only via RLS.

create table if not exists public.canvas_links (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  canvas_base_url text not null default 'https://canvas.uw.edu',
  access_token    text not null,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────── events ───────────────────────────
-- One team-formation event per class project round. Owner = the teacher.

create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  course_label     text not null,
  canvas_course_id text,
  target_team_size int  not null default 3 check (target_team_size between 2 and 8),
  remainder_policy text not null default 'strict_best_fit'
    check (remainder_policy in ('strict_best_fit', 'strict_manual', 'flexible_range')),
  min_size         int,
  max_size         int,
  straggler_policy text not null default 'neutral_default'
    check (straggler_policy in ('neutral_default', 'nudge', 'exclude')),
  state            text not null default 'draft'
    check (state in ('draft', 'enrolling', 'matched', 'in_progress', 'peer_review', 'closed')),
  target_end_date  date,
  is_demo          boolean not null default false,
  join_code        text unique,
  created_at       timestamptz not null default now()
);

create index if not exists events_owner_idx on public.events (owner_id);

-- ─────────────────────────── event members (roster) ───────────────────────────
-- Membership = who must be placed. user_id is null until a real account claims
-- the seat (matched by email); seeded/demo members keep user_id null.

create table if not exists public.event_members (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  user_id      uuid references public.profiles (id) on delete set null,
  roster_name  text not null,
  roster_email text not null,
  role         text not null default 'student' check (role in ('student', 'teacher', 'ta')),
  source       text not null default 'join_code'
    check (source in ('canvas', 'csv', 'join_code', 'seed')),
  created_at   timestamptz not null default now(),
  unique (event_id, roster_email)
);

create index if not exists event_members_event_idx on public.event_members (event_id);
create index if not exists event_members_user_idx  on public.event_members (user_id);

-- ─────────────────────────── student profiles (matching signal) ───────────────
-- The skills/schedule/interests Canvas can't provide; each student submits theirs.

create table if not exists public.student_profiles (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  member_id    uuid not null references public.event_members (id) on delete cascade,
  skills       text[] not null default '{}',
  availability int[]  not null default '{}',  -- 0..13 weekly slots
  comm_style   text   not null default 'mixed' check (comm_style in ('sync', 'async', 'mixed')),
  topics       text[] not null default '{}',
  complete     boolean not null default false,
  updated_at   timestamptz not null default now(),
  unique (event_id, member_id)
);

-- ─────────────────────────── teams ───────────────────────────

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  label      text not null,
  score      int  not null default 0,
  rationale  jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists teams_event_idx on public.teams (event_id);

create table if not exists public.team_members (
  team_id   uuid not null references public.teams (id) on delete cascade,
  member_id uuid not null references public.event_members (id) on delete cascade,
  primary key (team_id, member_id)
);

-- ─────────────────────────── ratings ───────────────────────────
-- Post-project peer ratings; raw rows are never exposed to students (only the
-- k-anonymous aggregate, served by the FastAPI service).

create table if not exists public.ratings (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events (id) on delete cascade,
  rater_member_id   uuid not null references public.event_members (id) on delete cascade,
  subject_member_id uuid not null references public.event_members (id) on delete cascade,
  dimension         text not null check (dimension in ('participation', 'communication', 'technical')),
  stars             int  not null check (stars between 1 and 5),
  created_at        timestamptz not null default now(),
  unique (event_id, rater_member_id, subject_member_id, dimension)
);

create index if not exists ratings_subject_idx on public.ratings (subject_member_id);

-- ─────────────────────────── reputation ───────────────────────────
-- Persisted Beta posteriors per user per dimension (the learning system that
-- carries across events). Seeded demo students don't accumulate cross-event rep.

create table if not exists public.reputation (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  dimension  text not null check (dimension in ('participation', 'communication', 'technical')),
  alpha      double precision not null default 1.0,
  beta       double precision not null default 1.0,
  updated_at timestamptz not null default now(),
  primary key (user_id, dimension)
);
