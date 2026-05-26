-- Instructor gate: only verified instructors may create events.
-- A user becomes an instructor by verifying a Canvas Teacher/TA enrollment.

alter table public.profiles
  add column if not exists is_instructor boolean not null default false;

-- Seed the project owner so she's never locked out of creating events.
update public.profiles set is_instructor = true
  where email ilike 'helswify@uw.edu';
