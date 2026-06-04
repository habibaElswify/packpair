# Design Your Own Project — PackPair

**Group 4:** Aasiya Sathar, Habiba Elswify
**Course:** CSS 382 — Introduction to AI · Spring 2026
**Submitted:** 2026-06-03

---

## UW Community Impact Statement

Poor team formation is one of the most persistent friction points in UW
coursework. Students are routinely placed into groups with incompatible
schedules, duplicate skill sets, or mismatched work styles — outcomes that
impair learning and inflate instructor overhead. PackPair addresses this
directly by automating team formation across any UW course.

**Specific benefits to the UW community:**

- Students spend less time negotiating teams and more time on the project itself.
- Instructors can create formation events in under five minutes (paste a Canvas
  Gradebook CSV, set a target team size) and receive balanced teams automatically.
- A growing reputation layer surfaces accountability problems early, protecting
  high-effort students from repeated free-rider situations.
- Roster-gated joins, Canvas-verified instructor identity, and `@uw.edu`-only
  sign-in keep the platform UW-specific by construction.
- The system improves every quarter as it accumulates ratings unique to UW
  courses and cohorts — the Bayesian reputation posteriors persist across every
  event a student is in.

---

## AI Integration Strategy

Three AI techniques are central to the application logic. None of them is a
side-chat or wrapper around an LLM; each addresses a distinct rubric concern
from the original proposal feedback.

### 1. Constraint Satisfaction for Team Formation

When an instructor presses "Form teams" on an event, the system builds a
constraint-satisfaction integer program over the enrolled students and solves
it with **Google OR-Tools CP-SAT** ([`solver/cpsat_matcher.py`](solver/cpsat_matcher.py)).

- **Hard constraints**: every student is in exactly one team; team size sits
  within `[min_size, max_size]` (e.g., 2–4 for a target of 3).
- **Soft objective** (weighted): `10 × |skill_union| + 5 × |shared_availability|
  + 3 × |shared_topics| + 5 if comm_styles ≤ 2`.
- **Scale fallback**: CP-SAT enumerates `C(n, k)` candidate teams; past ~12,000
  candidates (roughly >40 students) the request flips to a **greedy heuristic**
  in [`solver/matcher.py:_greedy`](solver/matcher.py). The greedy variant anchors
  a team on a high-signal student and adds best-fitting members. On an 18-student
  A/B test, CP-SAT scored **617 vs greedy's 444 (+39% objective uplift)** at the
  cost of ~10,000× more time — both real production paths, used depending on
  class size.
- **Why not AC-3 + backtracking (original proposal)?** CP-SAT subsumes both: it
  does arc-consistency propagation internally and uses portfolio search with
  conflict-driven clause learning, which outperforms hand-rolled backtracking
  on this objective shape.

### 2. Bayesian Peer Reputation

After each peer-review round, teammates submit anonymized ratings on three
dimensions: **participation, communication, technical contribution**. Each
student carries a **Beta(α, β)** posterior per dimension
([`solver/reputation.py`](solver/reputation.py)).

- **Conjugate update**: a 1–5 star rating `r` is normalized to evidence
  `s = (r − 1) / 4 ∈ [0, 1]`; the update is `α += s, β += 1 − s`. This is the
  standard Beta–Bernoulli conjugate pair extended to continuous evidence — a
  five-star rating contributes one full unit of "success," a one-star rating
  contributes one full unit of "failure," and intermediate stars split
  proportionally. Posterior mean is `α / (α + β)`; 95% credible interval is
  computed via `scipy.stats.beta.ppf`.
- **Cold-start handling**: new students start at the neutral **Beta(1, 1)**
  prior, posterior mean = 0.5. Wider credible intervals during the first
  ratings shrink as evidence accumulates — visualized on the reputation page
  as horizontal CI bars under each composite score.
- **Confidence weighting**: when reputation feeds the CP-SAT objective, each
  student's composite is shrunk toward the 0.5 neutral by
  `smoothing / (smoothing + n_observations)` (smoothing = 4, lined up with the
  k-anonymity threshold below). A noisy single rating cannot swing team
  formation; a well-evidenced track record gets near-full credit.
- **Cross-event accumulation**: reputation is keyed by `(user_id, dimension)`,
  not by event. The recompute (`rebuildReputationForEvent` in
  [`web/app/actions.ts`](web/app/actions.ts)) reads every rating a UW student
  has ever received across every PackPair event they were in. The reputation
  page renders that combined posterior, so a student's signal grows with their
  UW career.

### 3. k-Anonymity Privacy Guard

The third layer is the anti-gaming mitigation called out in the proposal
feedback: in three-person teams, a single rater can often be re-identified
from an exposed aggregate. We enforce **k-anonymity (k = 5)** on every
public-facing rating aggregate ([`solver/privacy.py`](solver/privacy.py)).

- A `RollingAggregator` tracks the most recent 50 ratings per
  `(subject, dimension)`. The mean is exposed publicly only when at least 5
  ratings back it; otherwise the field is suppressed and the UI shows
  "need 5 ratings to disclose (have N)."
- The guard is consistent between the per-dimension cells and the composite:
  if no dimension passes the threshold, the overall composite pill is replaced
  by a "gathering ratings · N of 15" badge instead of showing a number.
- Combined with cross-event accumulation, this means a student in a single
  3-person team won't see public scores from that event alone — but as they
  join more PackPair events, they accumulate enough ratings to disclose,
  while the rater-identity privacy is preserved.

**Pipeline composition.** CP-SAT proposes teams. The Bayesian reputation feeds
the CP-SAT objective via confidence-weighted bonuses (when reputation data is
available). The k-anonymity guard gates public disclosure of the resulting
aggregates. Three real techniques, each doing distinct work.

**Note on the original XGBoost team-success predictor** (week 1 proposal): the
training-data requirement (~200 labeled team outcomes from prior quarters) was
not satisfiable within the spring quarter timeline. We replaced it with the
k-anonymity privacy guard, which directly addresses the same proposal-feedback
concern (anti-gaming) and is verifiable against the running deployment today.
A supervised team-success model remains in the roadmap for next quarter once
real outcome data accumulates from the deployed app.

---

## Repository Access

- **Public repository**: <https://github.com/habibaElswify/packpair>
- **Instructor as collaborator**: `pisanuw` (verified via
  `gh api repos/habibaElswify/packpair/collaborators`).
- **Both team members as contributors**: `git log` shows commits from
  `Habiba ElSwify <habibaelswify@…>` (project lead) and
  `Aasiya Sathar <aash22@uw.edu>` (UI logo component + CI debugging).
- **CI**: GitHub Actions runs `pytest tests/` and `npm run build` on every
  push. Latest run green: see badge at top of `README.md`.

---

## Milestone Roadmap & Status

| Week | Planned | Status (2026-06-03) |
|------|---------|---|
| 1 | Setup, auth, profile builder, CSP prototype | ✅ Profile schema v1, hi-fi mockups, CSP prototype `team_matcher.py` |
| 2 | Reputation layer, full AI pipeline live | ✅ CP-SAT integration, Bayesian reputation with conjugate Beta updates, k-anonymity guard (replaced XGBoost — see above), public repo, landing page |
| 3 | Beta testing, documentation polish, final QA, submission | ✅ Three-tier deployment (Vercel + Render + Supabase), Canvas API integration with TA/Teacher verification, manual roster editing, real end-to-end test with a UW classmate (Aasiya Sathar) joining via Google OAuth and going through the full pipeline, CI pipeline, 39 passing tests, cross-event reputation persistence, A/B benchmarks artifact |

Every milestone was presented in class on schedule.

---

## Deployment & Access (no password required)

| | URL |
|---|---|
| **Live application** | <https://packpair.vercel.app> |
| **Public interactive demo (no login)** | <https://packpair.vercel.app/demo> |
| **Project landing page** | <https://habibaelswify.github.io/packpair/> |
| **Solver API health** | <https://packpair-solver.onrender.com/health> |

- Sign-in is Google OAuth gated to `@uw.edu` server-side. Any UW Google account
  works.
- Only Canvas-verified instructors (with a real Teacher/TA enrollment) can
  create events. Students join with an instructor-issued code.
- See `FINAL_SUBMISSION.md` and `README.md` in the repository for full
  rubric mapping, user guide, and architecture diagram.

---

## Tech Stack

Next.js 16 (App Router) on Vercel · Supabase (Postgres with row-level
security + Google OAuth + Realtime) · FastAPI solver microservice on Render ·
OR-Tools CP-SAT + greedy fallback · NumPy / scipy.stats for Beta posteriors ·
GitHub Actions CI · all free-tier.
