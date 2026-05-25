# PackPair — Supabase setup

The database schema and security rules for the project
(`skkzyervhxtgtsillkvh`).

## Apply the schema

Easiest path — the SQL Editor (no extra credentials needed):

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the entire contents of `migrations/0001_schema.sql`, click **Run**.
3. New query again, paste `migrations/0002_rls.sql`, click **Run**.

Both are idempotent (safe to re-run). Order matters: `0001` before `0002`.

## What gets created

- **profiles / canvas_links** — identity + a user's own Canvas access.
- **events / event_members** — a team-formation event and its roster.
- **student_profiles** — the skills/schedule/interests each student submits.
- **teams / team_members** — the formed teams.
- **ratings / reputation** — peer ratings and the persisted Bayesian posteriors.

## Security model

- Row-Level Security is on for every table.
- The **front-end** (publishable key) acts as the signed-in user and is
  constrained by the policies in `0002_rls.sql`: students see only their own
  data + their event's teams; teachers manage only events they own; raw ratings
  are never exposed (only the k-anonymous aggregate, served by the API).
- The **FastAPI service** uses the SECRET key, which bypasses RLS for trusted
  server-side writes (match results, reputation recompute).
