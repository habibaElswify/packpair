"""End-to-end demo of all three AI layers — the verification harness
that proves the modules compose correctly.

Pipeline:
  1. Roster of 12 mock students.
  2. Simulate post-project ratings → ReputationStore (Bayesian).
  3. Push the same ratings through the k-anonymity guard.
  4. Form teams via CP-SAT, with the Bayesian reputation as a bonus.
  5. Report the public (k-anonymous) view + the credible intervals.

Run: .venv/bin/python -m solver.demo_pipeline
"""

from __future__ import annotations

import random

from .cpsat_matcher import base_team_score, solve
from .privacy import DEFAULT_K, RollingAggregator, public_view
from .reputation import DIMENSIONS, ReputationStore, simulate_ratings
from .students import MOCK_POOL


def main() -> None:
    print("=" * 64)
    print("PackPair end-to-end pipeline demo")
    print("=" * 64)

    # 1. Roster
    pool = MOCK_POOL
    print(f"\n[1] Roster: {len(pool)} students\n")

    # 2. Bayesian reputation from synthetic rating history
    rep = ReputationStore()
    qualities = {s.name: 0.2 + 0.6 * ((i % 5) / 4.0)
                 for i, s in enumerate(pool)}
    for s in pool:
        simulate_ratings(rep, s.name, qualities[s.name], n=8, seed=hash(s.name) & 0xFF)
    print("[2] Bayesian posterior summary (sample of 3):")
    for s in pool[:3]:
        summary = rep.summary(s.name)
        print(f"    {s.name:14s}  composite={rep.composite(s.name):.3f}")
        for dim, stats in summary.items():
            print(f"      {dim:14s}  mean={stats['mean']:.3f}  "
                  f"95% CI=[{stats['ci_low']:.3f}, {stats['ci_high']:.3f}]  "
                  f"n={stats['n']}")

    # 3. k-anonymity guard
    agg = RollingAggregator(k=DEFAULT_K)
    rng = random.Random(42)
    for s in pool:
        n_ratings = rng.choice([2, 3, 7, 10])  # some below k=5, some above
        for _ in range(n_ratings):
            for dim in DIMENSIONS:
                noisy = max(0.0, min(1.0, qualities[s.name] + rng.gauss(0, 0.15)))
                agg.record(s.name, dim, 1.0 + 4.0 * noisy)
    print("\n[3] Public (k-anonymous, k=5) view — None = suppressed:")
    for s in pool[:5]:
        view = public_view(agg, s.name, DIMENSIONS)
        rendered = {d: f"{v:.2f}" if v is not None else "—"
                    for d, v in view.items()}
        n = agg.count(s.name, DIMENSIONS[0])
        print(f"    {s.name:14s}  n={n:2d}  {rendered}")

    # 4. CP-SAT match with reputation bonus
    bonus_fn = lambda team: rep.team_bonus([s.name for s in team])
    chosen, score, elapsed = solve(pool, team_size=3, reputation_bonus=bonus_fn)
    print(f"\n[4] CP-SAT match  |  {elapsed*1000:.1f} ms  |  total score {score}")
    for i, team in enumerate(chosen, start=1):
        names = ", ".join(s.name for s in team)
        base = base_team_score(team)
        bonus = bonus_fn(team)
        print(f"    Team {i}: {names}  (base={base}, bonus={bonus})")

    print("\n" + "=" * 64)
    print("All three AI layers wired together end-to-end.")
    print("=" * 64)


if __name__ == "__main__":
    main()
