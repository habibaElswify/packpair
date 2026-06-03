# PackPair

**AI-powered team formation for UW class projects.**
CSS 382 — Introduction to Artificial Intelligence · DYOP Final Project · Spring 2026
Team: Habiba Elswify · Aasiya Sathar

Landing page: <https://habibaelswify.github.io/packpair/>

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

## Web app *(in progress)*

The Next.js + Supabase + FastAPI vertical slice is being built out — see
`/docs/roadmap.md` for the current sprint. The solver package above is the AI core that the
web app will call.

## Milestones

| Week | Deliverable | Status |
| --- | --- | --- |
| 1 | Proposal accepted (5/5), profile schema v1, hi-fi mockups, CSP prototype | ✅ |
| 2 | CP-SAT integration, Bayesian reputation, k-anonymity guard, public repo, landing page | ✅ |
| 3 | Vercel deployment of vertical slice, friend pilot, DYOP writeup, final demo | In progress |

## License

MIT — see `LICENSE`.
