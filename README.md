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
