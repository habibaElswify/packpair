# PackPair — Full Backend & End-to-End Application Design

**Date:** 2026-05-25
**Authors:** Habiba Elswify, Aasiya Sathar
**Course:** CSS 382 — Introduction to AI · DYOP Final Project · due 2026-06-01
**Status:** Approved design, entering implementation

---

## 1. Goal

Turn PackPair from a polished static mock + a local Python solver into a **fully
functioning, deployed, multi-user web application** that a real UW class can use end
to end: a teacher creates a team-formation event, students join and build profiles,
the AI forms balanced teams, everyone sees their team live, and after the project
peers rate each other and reputation updates the next round.

This directly targets the two highest-risk DYOP rubric items:

| Rubric item | Pts | How this design earns it |
| --- | --- | --- |
| Technical Execution | 25 | A real, stable, public deployment of the working AI product |
| Project Web Presence | 15 | Existing `docs/about.html` landing page (already live) |
| AI Integration | 15 | All three AI layers stay server-side and central, not a side chat |

**Non-negotiables from the brainstorm:** everything real (real auth, real database,
real deployment), no simulated shortcuts in the production path, and a way for Habiba
(a student, not a Canvas teacher) to test and demo the full teacher+student workflow.

## 2. Architecture

Three tiers, each with one clear job:

```
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ Next.js + TypeScript     │    │ Supabase                  │    │ FastAPI (Python)         │
│ (Vercel)                 │    │ (managed Postgres)        │    │ "the AI brain" (Render)  │
│ product: UI, auth, CRUD  │◄──►│ source of truth + Auth +  │◄──►│ wraps existing solver/   │
│                          │    │ Realtime + RLS            │    │ CP-SAT · Bayesian · k-anon│
└──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
```

- **Next.js (Vercel):** all screens, Google sign-in, and CRUD of profiles/events/
  ratings via the type-safe Supabase JS client (guarded by Row-Level Security).
- **Supabase:** Postgres = single source of truth. Built-in Google OAuth (restricted
  to `uw.edu`, enforced server-side). Realtime broadcasts DB changes over WebSockets.
- **FastAPI (Render):** the AI brain. Reads the roster from Supabase, runs the
  **existing** `solver/` code (CP-SAT match, Bayesian reputation, k-anonymity), writes
  teams and reputation views back. Next.js calls it only to *trigger* matching and to
  *fetch* the k-anonymous reputation view. No AI logic is rewritten or weakened.

**Why Python stays a separate service:** OR-Tools is a heavy native dependency that
cannot run on Vercel serverless. Keeping it as a FastAPI service preserves the tested
AI core verbatim and keeps the AI "central, not a side chat" (the 5/5 proposal claim).

## 3. Data model (Supabase / Postgres)

- **profiles** — one row per signed-in user. `id` (auth uid), `email` (`@uw.edu`),
  `full_name`, `is_app_admin` (bool). Identity only; no class data.
- **canvas_links** — a user's connected Canvas access (token/OAuth), used to read
  *their own* enrollments. Per user, encrypted at rest.
- **events** — a team-formation event. `id`, `owner_id` (the verified teacher),
  `course_label`, `canvas_course_id` (nullable), `target_team_size`,
  `remainder_policy` (enum), `straggler_policy` (enum), `state` (enum lifecycle),
  `target_end_date` (nullable), `is_demo` (bool), `join_code`.
- **event_members** — roster membership. `event_id`, `user_id` (nullable until a real
  user claims the seat), `roster_name`, `roster_email`, `role` (student|teacher|ta),
  `source` (canvas|csv|join_code|seed).
- **student_profiles** — per-event matching attributes a student submits: `skills[]`,
  `availability[]` (14 weekly slots), `comm_style`, `topics[]`, `complete` (bool).
- **teams** / **team_members** — formed teams and their members, plus `score` and a
  `rationale` blob (skills covered, schedule overlap, shared topics).
- **ratings** — post-project peer ratings: `rater_id`, `subject_id`, `dimension`,
  `stars` (1–5), `event_id`. Anonymized in all reads.
- **reputation** — per-user Beta posteriors per dimension (`alpha`, `beta`), the
  persisted form of `solver/reputation.py`'s `BetaPosterior`.

**Row-Level Security:** students read only their own profile/team/ratings-they-gave;
teachers read their own events and rosters; reputation is exposed only through the
k-anonymous view. Demo (`is_demo=true`) rows are world-readable, never mixed with real data.

## 4. Authentication & the teacher gate

- **Identity:** Supabase Auth → Google provider. Real events require an `@uw.edu`
  account; the `uw.edu` domain is **enforced server-side** (verified email domain in a
  Postgres policy / auth hook), not merely the `hd` OAuth hint. No NetID/Shibboleth/
  UW-IT approval needed — every UW account is a Google Workspace `@uw.edu` account.
- **Teacher role = Canvas-verified, never self-asserted.** To create a real event for a
  course, a user connects Canvas; PackPair calls `GET /users/self/enrollments` and
  unlocks teacher tools **only** for courses where Canvas reports `TeacherEnrollment` or
  `TaEnrollment`. The same call lists "the classes you teach." A student's token returns
  only `StudentEnrollment` → no courses offered → teacher tools never unlock.
- **Fallback:** an app-admin "request instructor access → approve" path for a
  legitimate instructor who won't connect Canvas.

## 5. Roster onboarding (teacher-side, single source of truth)

The teacher imports the roster **once**; students never pull classmate data (safest;
matches Canvas permissions and the privacy guarantees in `solver/privacy.py`). Two paths
behind one "Import roster" step, defaulting to upload:

1. **Paste / CSV upload** (universal, no token, no permission wall): copy the Canvas
   **People** tab (visible to students too) and paste; works for any class.
2. **Canvas API auto-import** (when a teacher token exists): pull enrollments
   automatically for the verified course.

Canvas supplies **membership only**. Skills/schedule/interests/comm style live nowhere
in Canvas — each **student submits their own profile** in PackPair. That split is the
core of non-random matching.

## 6. Matching, coverage, and edge cases

The AI core (`solver/`) is reused; it is hardened so **every student is always placed**.

### 6.1 Team size + remainder policy (teacher picks at creation)

| Policy | Behaviour | Leftovers |
| --- | --- | --- |
| `strict_best_fit` *(default)* | All teams exactly N; each leftover placed by the model into its best-fit team (some become N+1) | none — model decides |
| `strict_manual` | All teams exactly N; leftovers held in an "unplaced" tray for the teacher to drag in | none — teacher decides |
| `flexible_range` | Teacher sets a range (e.g. 3–4 or 2–4); solver forms every team within range | none by construction |

Multiple leftovers scale naturally (range absorbs all; best-fit distributes each;
manual holds all). **Code change required:** `cpsat_matcher.py` currently rejects pools
not divisible by team size — it must support remainder policies and a hard
"every student assigned exactly once" constraint.

### 6.2 Stragglers (no profile by match time) — teacher policy + manual

`neutral_default` (place on a Beta(1,1)-style neutral profile · default) ·
`nudge` (reminder, hold the seat) · `exclude` (leave unplaced, teacher handles).

### 6.3 Late joiners + override (no forced re-run)

After teams form, the event **locks**. New students enter a "needs placement" queue;
the model **suggests** the best-fit team for one-click slot-in. A teacher **edit mode**
can move *any* student between teams at any time, with team scores recomputed live so
the teacher sees the impact. A full re-run is always optional, never automatic.

## 7. Event lifecycle & peer-review workflow

```
Draft → Enrolling → Matched (teams live) → In Progress → Peer Review Open → Closed
```

- Teacher sets a **target end date** at creation: sets expectations, drives reminders,
  can auto-prompt the review window.
- **Authoritative trigger is the teacher** flipping "Open peer review" — everyone enters
  review at the same moment. Students may tap "we've wrapped up" as a *signal* only.
- Rationale: synchronization keeps ratings inside a window so the k-anonymity guard
  (k=5) actually protects raters; teacher control prevents self-opening as a gaming
  vector; reflects that projects slip.
- Teacher closes the window → Bayesian reputation recomputes → feeds the next event.

## 8. Real-time updates

Supabase **Realtime** broadcasts `team_members` / `events.state` changes over
WebSockets. When the teacher forms teams or opens review, every connected student's
view updates instantly with no refresh.

## 9. Demo Class sandbox (testing + how Habiba demos the teacher side)

A first-class feature, not a hack — it reuses `solver/students.py`
(`MOCK_POOL`, `synthetic_pool`):

- One-click **Demo Class** seeded with 12 or 30 synthetic students + varied profiles.
- The signed-in user acts as **teacher** *and* can drop into **any student's view**.
- **"Simulate ratings"** runs `simulate_ratings` so reputation curves move and
  k-anonymity badges flip — the whole loop, solo.
- **"Reset to clean"** so every test/demo starts fresh.
- All sandbox data is `is_demo=true`, isolated from real student data.

**Real events require Canvas-verified teachers; the sandbox is open** (synthetic data, no
privacy risk) so Habiba — a student — can exercise and demo the full teacher+student flow.

**Open toggle (default chosen, adjustable):** the demo sandbox allows "continue as
guest" so non-UW viewers can try it; **real events stay `@uw.edu`-gated**. Flip to
UW-only if we'd rather keep the product strictly UW-exclusive.

## 10. Testing & demo-readiness

1. **Automated tests** — solver unit tests (extend `demo_pipeline.py`), FastAPI
   integration tests (TestClient), and **one full-lifecycle e2e test**
   (create → seed → match → rate → reputation) that must pass before any deploy.
2. **Stress tests** — large rosters (30/60/90), every remainder case (N mod size ≠ 0),
   degenerate inputs (all-identical profiles, all-disjoint availability, empty
   profiles), and timing budgets.
3. **Real multi-user check** — Habiba + Aasiya + a couple `@uw.edu` friends, plus two
   browser profiles (regular + incognito), to confirm real Google auth + Realtime.
4. **Staging deploy** — Vercel preview + Render staging, so testing happens on the real
   deployed stack, not just localhost.
5. **Manual smoke-test checklist** run against the live URL before any share-out.

## 11. Deployment & division of labor

| Piece | Platform | Who can do it |
| --- | --- | --- |
| FastAPI solver service | Render | Claude builds; **Habiba** creates the Render service / connects repo |
| Postgres + Auth + Realtime | Supabase | Claude writes schema/migrations; **Habiba** creates the project, gets keys |
| Google OAuth credentials | Google Cloud Console | **Habiba** (her Google account) |
| Canvas token (for teacher import demo) | Canvas | **Habiba** generates a personal token |
| Next.js front-end | Vercel | Claude builds; **Habiba** connects repo + sets env vars |

Claude builds and tests everything that doesn't require Habiba's accounts, then hands a
precise ordered checklist for the interactive setup so the end-to-end demo is real. We
do not claim "deployed" until it is verified live.

## 12. Build increments

1. **Solver hardening** — remainder policies, full-coverage guarantee, stragglers,
   move/override + live re-scoring, stress tests. *(fully local, fully testable)*
2. **FastAPI service** — wrap the solver; `/match`, `/reputation`, `/health`; CORS;
   integration tests; deployable to Render.
3. **Supabase schema + RLS + migrations** — the data model in §3.
4. **Next.js app** — auth, profile, matches, rating, reputation; Realtime wiring.
5. **Canvas integration** — enrollments verification + roster import (CSV + API).
6. **Demo Class sandbox** + reset.
7. **End-to-end test + staging deploy + smoke checklist**, then production deploy.
8. *(bonus)* MCP teacher tool wrapping roster-sync + matching.
