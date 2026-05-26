-- Enable Supabase Realtime broadcasts for the tables the UI watches live.
-- Run in the SQL Editor after 0001/0002. Realtime still respects RLS, so each
-- client only receives changes to rows it's allowed to read.

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.team_members;
