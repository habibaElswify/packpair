-- One-time event cleanup before submission.
--
-- Keeps:
--   - the public /demo sandbox (`is_demo = true`)
--   - exactly ONE real CSS 382 event for the grader: the one Aasiya joined
--
-- Deletes everything else.  Run only when you're sure — FK cascades will
-- remove rosters, profiles, teams, and ratings tied to the deleted events.

begin;

-- 1. Find the keeper: the CSS 382 event whose roster includes Aasiya
--    (aash22@uw.edu).  Stored so the delete below excludes it.
with keeper as (
  select e.id
  from public.events e
  join public.event_members em on em.event_id = e.id
  where em.roster_email = 'aash22@uw.edu'
    and e.course_label ilike 'CSS 382%'
  order by e.created_at desc
  limit 1
)
delete from public.events e
where not e.is_demo                      -- never touch the /demo sandbox
  and e.id not in (select id from keeper);

-- 2. Sanity check — what's left should be exactly 2 events.
select id, course_label, state, is_demo, created_at
from public.events
order by created_at desc;

commit;

-- If the "Sanity check" output looks wrong, you can rollback by replacing the
-- final `commit;` with `rollback;` and re-running. Once you commit you can't
-- undo without restoring from a Supabase backup.
