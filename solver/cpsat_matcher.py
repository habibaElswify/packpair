"""CP-SAT team matcher — replaces the Week 1 brute-force enumerator.

Models team formation as an integer program over assignment variables
x[s, t] in {0, 1} with constraints (each student in exactly one team,
each team filled to capacity) and a weighted objective combining:

    skill diversity  +  schedule overlap  +  topic alignment  +  comm fit
                     +  Bayesian-reputation adjustment

The reputation term is computed outside the solver per candidate team
and folded into the objective via a precomputed lookup, because team-
score is non-linear in the assignment vector.

For pools up to ~30 students this runs sub-second on a laptop; brute-
force enumeration becomes infeasible past ~15 students.
"""

from __future__ import annotations

import time
from itertools import combinations
from typing import Callable, Dict, List, Optional, Tuple

from ortools.sat.python import cp_model

from .students import Student


Team = Tuple[Student, ...]
Partition = Tuple[Team, ...]


def base_team_score(team: Team) -> int:
    """Same weighted score as the Week 1 prototype.

    score = 10 * |union of skills|
          +  5 * |shared availability slots|
          +  3 * |shared topic interests|
          +  5 if at most two distinct comm styles
    """
    all_skills: set = set()
    shared_slots = set(team[0].available)
    shared_topics = set(team[0].topics)
    styles = set()
    for s in team:
        all_skills |= s.skills
        shared_slots &= s.available
        shared_topics &= s.topics
        styles.add(s.comm_style)

    score = 10 * len(all_skills)
    score += 5 * len(shared_slots)
    score += 3 * len(shared_topics)
    score += 5 if len(styles) <= 2 else 0
    return score


def solve(
    pool: List[Student],
    team_size: int = 3,
    *,
    reputation_bonus: Optional[Callable[[Team], int]] = None,
    time_limit_s: float = 10.0,
) -> Tuple[Partition, int, float]:
    """Return (best partition, total score, wall-clock seconds).

    `reputation_bonus`, if provided, returns an integer points bonus for
    a candidate team (e.g. from the Bayesian reputation module). It is
    evaluated once per candidate team during model construction.
    """
    n = len(pool)
    if n % team_size != 0:
        raise ValueError(f"pool size {n} not divisible by team_size {team_size}")
    n_teams = n // team_size

    # Enumerate every candidate team (every C(n, team_size) combination).
    # For n=30, team_size=3 this is 4,060 candidates — well within CP-SAT range.
    candidates: List[Team] = [tuple(pool[i] for i in combo)
                              for combo in combinations(range(n), team_size)]
    scores: List[int] = []
    for team in candidates:
        s = base_team_score(team)
        if reputation_bonus is not None:
            s += reputation_bonus(team)
        scores.append(s)

    model = cp_model.CpModel()

    # x[c] = 1 if candidate team c is selected
    x = [model.NewBoolVar(f"x_{c}") for c in range(len(candidates))]

    # Exactly n_teams candidate teams chosen
    model.Add(sum(x) == n_teams)

    # Each student appears in exactly one selected team
    name_to_idx: Dict[str, int] = {s.name: i for i, s in enumerate(pool)}
    student_in_candidates: List[List[int]] = [[] for _ in range(n)]
    for c, team in enumerate(candidates):
        for s in team:
            student_in_candidates[name_to_idx[s.name]].append(c)
    for i in range(n):
        model.Add(sum(x[c] for c in student_in_candidates[i]) == 1)

    # Maximize total weighted score
    model.Maximize(sum(scores[c] * x[c] for c in range(len(candidates))))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.num_search_workers = 4

    t0 = time.perf_counter()
    status = solver.Solve(model)
    elapsed = time.perf_counter() - t0

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"solver failed: status={solver.StatusName(status)}")

    chosen = tuple(candidates[c] for c in range(len(candidates))
                   if solver.Value(x[c]) == 1)
    return chosen, int(solver.ObjectiveValue()), elapsed
