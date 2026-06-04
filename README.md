# PackPair

[![CI](https://github.com/habibaElswify/packpair/actions/workflows/ci.yml/badge.svg)](https://github.com/habibaElswify/packpair/actions/workflows/ci.yml)

**AI-powered team formation for UW class projects.**
CSS 382 — Introduction to Artificial Intelligence · DYOP Final Project · Spring 2026
Team: Habiba Elswify · Aasiya Sathar — see [CONTRIBUTIONS.md](CONTRIBUTIONS.md) for the per-person split per week.

Landing page: <https://habibaelswify.github.io/packpair/>

## 🚀 For graders — start here

| | URL | What to do |
|---|---|---|
| **Live app** | <https://packpair.vercel.app> | Sign in with any `@uw.edu` Google account (click through Google's "unverified app" notice — we only ask for `email` + `profile`). |
| **Public demo (no login)** | <https://packpair.vercel.app/demo> | Click **"New class → form teams"** to run the real CP-SAT solver live; **"Run a peer-rating round"** to drive the Bayesian + k-anonymity layers. |
| **Project landing page** | <https://habibaelswify.github.io/packpair/> | Tech overview + architecture diagram + AI-layers explanation. |
| **AI brain** | <https://packpair-solver.onrender.com/health> | FastAPI solver service (returns `{"status":"ok"}`; free-tier ~30s cold start on first hit). |

**To verify the instructor gate works:** sign in as a student → no "+ Create event" button appears. Then visit `/instructor`, paste a UW Canvas API token where you teach or TA — `is_instructor` is flipped to true and "+ Create event" appears. (Habiba was seeded as the project owner; verification works for any TA/Teacher via Canvas.)

**Per-person contributions:** [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md). The commit history shows only Habiba's GitHub account because we pair-programmed and pushed from one laptop — Aasiya's design, schema, privacy code, and writeup are documented in the weekly status decks (`Week 1/2/3 .pptx`).

**Peer Review survey:** filed via Canvas separately (per the rubric).

## What it does

UW students fill out a profile (skills, schedule, communication style, topic interests). PackPair
forms balanced project teams using three AI techniques:

1. **Constraint-satisfaction search** — Google OR-Tools CP-SAT picks the partition that maximizes a
   weighted objective (skill diversity + schedule overlap + topic alignment + comm-style fit).
2. **Bayesian peer-reputation** — each student carries a `Beta(α, β)` posterior per rating dimension;
   new students start at the neutral `Beta(1, 1)` prior (cold-start mitigation).
3. **Supervised team-success prediction** *(roadmap)* — peer-rating outcomes re-weight the search
   objective each quarter.

The two AI-feedback risks from the proposal review are mitigated in code:

| Risk | Mitigation | File |
| --- | --- | --- |
| Cold-start (no rating data on day one) | Neutral Beta(1, 1) prior; conjugate updates from ratings | `solver/reputation.py` |
| Anti-gaming (3-person team ratings re-identifiable) | k-anonymity guard (k = 5) on rolling aggregates | `solver/privacy.py` |

## Repository layout

```
packpair/
├── README.md
├── solver/                  # the Python AI core
│   ├── students.py          # Student dataclass + mock pool + synthetic roster
│   ├── cpsat_matcher.py     # OR-Tools CP-SAT integer program
│   ├── reputation.py        # Bayesian Beta-prior reputation
│   ├── privacy.py           # k-anonymity guard
│   ├── demo_pipeline.py     # end-to-end demo of all three layers
│   └── cli.py               # CLI entry point
└── docs/                    # public landing page (served on GitHub Pages from /docs)
    ├── index.html
    ├── mockup.png
    └── architecture.png
```

## Run it locally

```bash
git clone https://github.com/habibaElswify/packpair
cd packpair
python3 -m venv .venv
.venv/bin/pip install ortools scipy

# End-to-end demo of all three AI layers
.venv/bin/python -m solver.demo_pipeline

# CP-SAT solver standalone
.venv/bin/python -m solver.cli                 # 12-student mock pool
.venv/bin/python -m solver.cli --n 30          # 30-student scaling test
.venv/bin/python -m solver.cli --with-reputation
```

### Matcher hyperparameters

Tuning is documented and central, not hidden — each weight is justified:

| Term | Weight | Where | Why |
| --- | --- | --- | --- |
| Skill diversity (`|union of skills|`) | **× 10** | `solver/cpsat_matcher.py:51` | Largest weight: balanced teams need complementary skills, the headline objective. |
| Shared availability slots | **× 5** | `solver/cpsat_matcher.py:52` | A team that can never meet is worse than one with skill overlap; second-highest. |
| Shared topic interests | **× 3** | `solver/cpsat_matcher.py:53` | Mild bonus: alignment helps motivation but isn't a hard constraint. |
| Communication style cohesion | **+ 5** if ≤ 2 distinct styles | `solver/cpsat_matcher.py:54` | Step function: mixing 3 styles (sync + async + mixed) tends to fail. |
| Reputation team bonus | **× 20** (mean composite ∈ [0,1]) | `solver/reputation.py:91` | Bounded so reputation can shift CP-SAT's choice without dominating skill diversity. |
| k-anonymity threshold | **k = 5** | `solver/privacy.py:20` | Below this, an aggregate from a 3-person team would re-identify a single rater. |
| Bayesian prior | **Beta(1, 1)** | `solver/reputation.py:25` | Neutral uniform prior; cold-start fix from the proposal feedback. |

### Benchmarks (M1 Max)

| Pool size | Time-to-optimal | Notes |
| --- | --- | --- |
| 12 students | ~20 ms | Was ~120 ms with the Week 1 brute-force enumerator |
| 30 students | ~10 s | Brute force infeasible past ~15 students |

## Web app

The Next.js 16 + Supabase + FastAPI stack is live at
**<https://packpair.vercel.app>**. The solver package above is the AI core that
the web app calls. See [`FINAL_SUBMISSION.md`](FINAL_SUBMISSION.md) for the
grader-facing single-document write-up.

## Access & security

- **No password required.** Sign-in uses Google OAuth, gated to `@uw.edu` accounts
  server-side. Any UW Google account can sign in; only Canvas-verified instructors
  can create events; students join with an instructor-issued code.
- **Public, no-login demo**: <https://packpair.vercel.app/demo> runs the real
  CP-SAT solver on a fresh synthetic class on every click.
- Instructor verification uses the user's own Canvas access token; PackPair never
  stores it.

## Milestones

| Week | Deliverable | Status |
| --- | --- | --- |
| 1 | Proposal accepted (5/5), profile schema v1, hi-fi mockups, CSP prototype | ✅ |
| 2 | CP-SAT integration, Bayesian reputation, k-anonymity guard, public repo, landing page | ✅ |
| 3 | Vercel/Render/Supabase three-tier deployment, Canvas integration, manual roster editing, real end-to-end test with Aasiya, CI pipeline, final demo | ✅ |

## License

MIT — see `LICENSE`.
