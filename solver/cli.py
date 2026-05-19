"""Demo CLI for the PackPair solver — the same output the Week 1
prototype produced, but routed through CP-SAT and optionally augmented
with a Bayesian reputation bonus.

Run with the project venv:
    .venv/bin/python -m solver.cli                  # 12-student mock pool
    .venv/bin/python -m solver.cli --n 30           # 30-student scaling test
    .venv/bin/python -m solver.cli --with-reputation
"""

from __future__ import annotations

import argparse
import sys

from .cpsat_matcher import base_team_score, solve
from .reputation import ReputationStore, simulate_ratings
from .students import MOCK_POOL, synthetic_pool


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="PackPair CP-SAT demo")
    p.add_argument("--n", type=int, default=12,
                   help="pool size (default 12; 12 → mock pool, otherwise synthetic)")
    p.add_argument("--team-size", type=int, default=3)
    p.add_argument("--with-reputation", action="store_true",
                   help="Seed a synthetic reputation history and apply the team bonus.")
    args = p.parse_args(argv)

    pool = MOCK_POOL if args.n == 12 else synthetic_pool(args.n)
    if len(pool) % args.team_size != 0:
        print(f"ERR: pool size {len(pool)} not divisible by team size {args.team_size}",
              file=sys.stderr)
        return 2

    bonus_fn = None
    if args.with_reputation:
        store = ReputationStore()
        # Simulate a quality spread across the pool so the bonus is non-trivial.
        for i, s in enumerate(pool):
            true_q = 0.2 + 0.6 * ((i % 5) / 4.0)  # 0.2..0.8 spread
            simulate_ratings(store, s.name, true_q, n=10, seed=i)
        bonus_fn = lambda team: store.team_bonus([s.name for s in team])

    print("=" * 64)
    print(f"PackPair — CP-SAT Team Matcher  |  pool={len(pool)}  "
          f"team_size={args.team_size}  reputation={args.with_reputation}")
    print("=" * 64)

    chosen, score, elapsed = solve(
        pool, team_size=args.team_size, reputation_bonus=bonus_fn,
    )
    print(f"Solved in {elapsed*1000:.1f} ms  |  total score {score}\n")
    for i, team in enumerate(chosen, start=1):
        names = ", ".join(s.name for s in team)
        base = base_team_score(team)
        bonus = bonus_fn(team) if bonus_fn else 0
        print(f"Team {i}: {names}")
        print(f"  base={base}  reputation_bonus={bonus}  total={base + bonus}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
