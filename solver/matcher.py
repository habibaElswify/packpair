"""Hardened team matcher — guarantees every student is placed exactly once.

Generalizes ``cpsat_matcher.solve`` (which required the pool to divide evenly)
to real classrooms where the roster rarely divides by the target team size.

The teacher picks a ``remainder_policy`` describing what happens to leftovers:

* ``flexible_range``  — every team's size is in ``[min_size, max_size]``;
  nobody is ever a remainder.
* ``strict_best_fit`` — teams are exactly ``target_size`` except a few that
  absorb leftovers (size ``target_size + 1``); the model decides which.
* ``strict_manual``   — only exact ``target_size`` teams are formed; the
  leftover students are returned in ``unplaced`` for the teacher to place.

Every policy is a set-partitioning integer program over candidate teams, so the
"each student in exactly one team" guarantee is a hard constraint.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from itertools import combinations
from math import comb
from typing import Callable, List, Optional, Tuple

from ortools.sat.python import cp_model

from .cpsat_matcher import base_team_score
from .students import Student

Team = Tuple[Student, ...]


@dataclass
class MatchResult:
    teams: List[Team]
    unplaced: List[Student] = field(default_factory=list)
    score: int = 0
    elapsed_s: float = 0.0


def form_teams(
    pool: List[Student],
    target_size: int = 3,
    *,
    remainder_policy: str = "flexible_range",
    min_size: Optional[int] = None,
    max_size: Optional[int] = None,
    reputation_bonus: Optional[Callable[[Team], int]] = None,
    time_limit_s: float = 10.0,
) -> MatchResult:
    n = len(pool)
    if remainder_policy == "flexible_range":
        lo = min_size if min_size is not None else target_size - 1
        hi = max_size if max_size is not None else target_size + 1
        sizes = list(range(lo, hi + 1))
        num_teams: Optional[int] = None
        cover = "exact"
    elif remainder_policy == "strict_best_fit":
        num_teams = max(1, n // target_size)
        biggest = n - (num_teams - 1) * target_size  # team that absorbs leftovers
        sizes = list(range(min(target_size, n), biggest + 1))
        cover = "exact"
    elif remainder_policy == "strict_manual":
        num_teams = n // target_size
        sizes = [target_size]
        cover = "at_most"
    else:
        raise NotImplementedError(f"remainder_policy {remainder_policy!r} not implemented")

    # Exact CP-SAT enumerates every candidate team; past ~12k candidates that's
    # too heavy for a small server, so fall back to a fast greedy heuristic.
    candidates = sum(comb(n, k) for k in sizes if k <= n)
    if candidates > _CANDIDATE_LIMIT:
        return _greedy(pool, target_size, remainder_policy, reputation_bonus)
    return _partition(
        pool, sizes, reputation_bonus, time_limit_s, num_teams=num_teams, cover=cover
    )


_CANDIDATE_LIMIT = 12000


def _greedy(
    pool: List[Student],
    target_size: int,
    remainder_policy: str,
    reputation_bonus: Optional[Callable[[Team], int]],
) -> MatchResult:
    """Fast heuristic for large rosters: anchor a team, greedily add the
    best-fitting remaining students, then distribute any leftovers. Scales
    linearly-ish, so it handles big classes the exact solver can't."""
    t0 = time.perf_counter()

    def score(team) -> int:
        s = base_team_score(tuple(team))
        if reputation_bonus is not None:
            s += reputation_bonus(tuple(team))
        return s

    remaining = list(pool)
    n = len(pool)
    n_teams = n // target_size if remainder_policy == "strict_manual" else max(1, n // target_size)

    teams: List[List[Student]] = []
    for _ in range(n_teams):
        if not remaining:
            break
        team = [remaining.pop(0)]
        while len(team) < target_size and remaining:
            best = max(remaining, key=lambda s: score(team + [s]))
            team.append(best)
            remaining.remove(best)
        teams.append(team)

    unplaced: List[Student] = []
    if remainder_policy == "strict_manual":
        unplaced = list(remaining)
    else:  # absorb leftovers into the best-fitting team
        for s in remaining:
            bi = max(range(len(teams)), key=lambda i: score(teams[i] + [s]))
            teams[bi].append(s)

    formed = [tuple(t) for t in teams]
    return MatchResult(
        teams=formed,
        unplaced=unplaced,
        score=sum(base_team_score(t) for t in formed),
        elapsed_s=time.perf_counter() - t0,
    )


def score_teams(teams: List[Team]) -> List[int]:
    """Base score per team — what the teacher's edit view shows live."""
    return [base_team_score(team) for team in teams]


def move_student(
    teams: List[Team], student_name: str, dest_index: int
) -> List[Team]:
    """Return new teams with ``student_name`` moved into team ``dest_index``.

    Used by the teacher edit/override mode. Nobody is dropped; the student is
    removed from whichever team currently holds them and added to the target.
    """
    moving: Optional[Student] = None
    stripped: List[List[Student]] = []
    for team in teams:
        kept = [s for s in team if s.name != student_name]
        for s in team:
            if s.name == student_name:
                moving = s
        stripped.append(kept)
    if moving is None:
        raise ValueError(f"student {student_name!r} not found in any team")
    stripped[dest_index].append(moving)
    return [tuple(team) for team in stripped]


def _partition(
    pool: List[Student],
    sizes,
    reputation_bonus: Optional[Callable[[Team], int]],
    time_limit_s: float,
    *,
    num_teams: Optional[int] = None,
    cover: str = "exact",
) -> MatchResult:
    """Select a subset of candidate teams over the pool.

    ``cover="exact"`` (default) forces every student into exactly one team;
    ``cover="at_most"`` lets students go unplaced (returned in ``unplaced``).
    If ``num_teams`` is given, exactly that many teams must be selected.
    """
    n = len(pool)
    candidates: List[Team] = []
    scores: List[int] = []
    for k in sizes:
        for combo in combinations(range(n), k):
            team = tuple(pool[i] for i in combo)
            s = base_team_score(team)
            if reputation_bonus is not None:
                s += reputation_bonus(team)
            candidates.append(team)
            scores.append(s)

    model = cp_model.CpModel()
    x = [model.NewBoolVar(f"x_{c}") for c in range(len(candidates))]

    # Each student belongs to exactly one selected team.
    name_to_idx = {s.name: i for i, s in enumerate(pool)}
    in_candidates: List[List[int]] = [[] for _ in range(n)]
    for c, team in enumerate(candidates):
        for s in team:
            in_candidates[name_to_idx[s.name]].append(c)
    for i in range(n):
        student_sum = sum(x[c] for c in in_candidates[i])
        if cover == "exact":
            model.Add(student_sum == 1)
        else:  # "at_most"
            model.Add(student_sum <= 1)

    if num_teams is not None:
        model.Add(sum(x) == num_teams)

    model.Maximize(sum(scores[c] * x[c] for c in range(len(candidates))))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.num_search_workers = 8
    # Stop once provably within 2% of optimal — turns a 10s "prove it" wait into
    # a sub-second near-optimal answer on big classes. time_limit_s is the cap.
    solver.parameters.relative_gap_limit = 0.02

    t0 = time.perf_counter()
    status = solver.Solve(model)
    elapsed = time.perf_counter() - t0

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"solver failed: status={solver.StatusName(status)}")

    teams = [candidates[c] for c in range(len(candidates)) if solver.Value(x[c]) == 1]
    placed = {s.name for team in teams for s in team}
    unplaced = [s for s in pool if s.name not in placed]
    return MatchResult(
        teams=teams,
        unplaced=unplaced,
        score=int(solver.ObjectiveValue()),
        elapsed_s=elapsed,
    )
