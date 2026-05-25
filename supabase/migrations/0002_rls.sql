-- PackPair Row-Level Security.
-- Front-end (publishable key) acts as the signed-in user under these rules.
-- The FastAPI service uses the SECRET key, which BYPASSES RLS for trusted
-- server-side writes (match results, reputation recompute).

-- ─────────── SECURITY DEFINER helpers (avoid recursive RLS) ───────────

create or replace function public.is_event_owner(eid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.events where id = eid and owner_id = uid)
$$;

create or replace function public.is_event_member(eid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.event_members where event_id = eid and user_id = uid)
$$;

create or replace function public.member_belongs_to(mid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.event_members where id = mid and user_id = uid)
$$;

create or replace function public.is_demo_event(eid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.events where id = eid and is_demo)
$$;

-- ─────────── enable RLS everywhere ───────────

alter table public.profiles         enable row level security;
alter table public.canvas_links     enable row level security;
alter table public.events           enable row level security;
alter table public.event_members    enable row level security;
alter table public.student_profiles enable row level security;
alter table public.teams            enable row level security;
alter table public.team_members     enable row level security;
alter table public.ratings          enable row level security;
alter table public.reputation       enable row level security;

-- ─────────── profiles ───────────
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

-- ─────────── canvas_links (owner only) ───────────
drop policy if exists canvas_links_owner on public.canvas_links;
create policy canvas_links_owner on public.canvas_links
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────── events ───────────
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (
    is_demo or owner_id = auth.uid() or public.is_event_member(id, auth.uid())
  );
drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert with check (owner_id = auth.uid());
drop policy if exists events_modify_owner on public.events;
create policy events_modify_owner on public.events
  for update using (owner_id = auth.uid());
drop policy if exists events_delete_owner on public.events;
create policy events_delete_owner on public.events
  for delete using (owner_id = auth.uid());

-- ─────────── event_members ───────────
drop policy if exists event_members_select on public.event_members;
create policy event_members_select on public.event_members
  for select using (
    public.is_demo_event(event_id)
    or public.is_event_owner(event_id, auth.uid())
    or public.is_event_member(event_id, auth.uid())
  );
drop policy if exists event_members_write_owner on public.event_members;
create policy event_members_write_owner on public.event_members
  for all using (public.is_event_owner(event_id, auth.uid()))
  with check (public.is_event_owner(event_id, auth.uid()));

-- ─────────── student_profiles ───────────
-- A student edits their own seat's profile; the teacher can read all in the event.
drop policy if exists student_profiles_select on public.student_profiles;
create policy student_profiles_select on public.student_profiles
  for select using (
    public.is_demo_event(event_id)
    or public.is_event_owner(event_id, auth.uid())
    or public.member_belongs_to(member_id, auth.uid())
  );
drop policy if exists student_profiles_upsert_own on public.student_profiles;
create policy student_profiles_upsert_own on public.student_profiles
  for all using (
    public.member_belongs_to(member_id, auth.uid())
    or public.is_event_owner(event_id, auth.uid())
  )
  with check (
    public.member_belongs_to(member_id, auth.uid())
    or public.is_event_owner(event_id, auth.uid())
  );

-- ─────────── teams + team_members (read for members/owner/demo) ───────────
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select using (
    public.is_demo_event(event_id)
    or public.is_event_owner(event_id, auth.uid())
    or public.is_event_member(event_id, auth.uid())
  );

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select using (
    exists (
      select 1 from public.teams t
      where t.id = team_id and (
        public.is_demo_event(t.event_id)
        or public.is_event_owner(t.event_id, auth.uid())
        or public.is_event_member(t.event_id, auth.uid())
      )
    )
  );

-- ─────────── ratings (rater sees only their own; raw rows otherwise hidden) ───────────
drop policy if exists ratings_own on public.ratings;
create policy ratings_own on public.ratings
  for all using (public.member_belongs_to(rater_member_id, auth.uid()))
  with check (public.member_belongs_to(rater_member_id, auth.uid()));

-- ─────────── reputation (a user sees only their own) ───────────
drop policy if exists reputation_select_own on public.reputation;
create policy reputation_select_own on public.reputation
  for select using (user_id = auth.uid());
