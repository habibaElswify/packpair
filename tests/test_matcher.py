"""Tests for the hardened team matcher (solver.matcher).

Core guarantee under test: *every* student is always placed exactly once,
for any roster size, under each remainder policy.
"""

from __future__ import annotations

from solver.matcher import form_teams, move_student, score_teams
from solver.students import Student, fs, fi


def make_pool(n: int):
    """n distinct students with identical attributes (size logic is what we test)."""
    return [
        Student(f"S{i:03d}", fs("a", "b"), fi(0, 1, 2), "sync", fs("ai"))
        for i in range(n)
    ]


def all_placed(result):
    return [s for team in result.teams for s in team]


def test_flexible_range_places_every_student_when_not_divisible():
    pool = make_pool(10)  # 10 is not divisible by a target size of 3
    result = form_teams(
        pool, target_size=3, remainder_policy="flexible_range", min_size=2, max_size=4
    )

    placed = all_placed(result)
    assert len(placed) == 10
    assert {s.name for s in placed} == {s.name for s in pool}  # each exactly once
    assert all(2 <= len(team) <= 4 for team in result.teams)
    assert result.unplaced == []


def test_strict_best_fit_absorbs_leftovers_no_team_below_target():
    pool = make_pool(10)  # 10 = 3 + 3 + 4 ; one team absorbs the leftover
    result = form_teams(pool, target_size=3, remainder_policy="strict_best_fit")

    placed = all_placed(result)
    assert {s.name for s in placed} == {s.name for s in pool}  # everyone, once
    assert len(result.teams) == 3  # floor(10 / 3) teams
    assert all(len(team) >= 3 for team in result.teams)  # never below target
    assert sorted(len(t) for t in result.teams) == [3, 3, 4]
    assert result.unplaced == []


def test_strict_manual_holds_leftovers_for_teacher():
    pool = make_pool(10)  # 3 exact teams of 3 ; 1 leftover for the teacher
    result = form_teams(pool, target_size=3, remainder_policy="strict_manual")

    assert len(result.teams) == 3
    assert all(len(team) == 3 for team in result.teams)
    assert len(result.unplaced) == 1
    # placed + unplaced together account for everyone, exactly once
    names = {s.name for team in result.teams for s in team} | {
        s.name for s in result.unplaced
    }
    assert names == {s.name for s in pool}


def test_move_student_relocates_and_keeps_everyone():
    pool = make_pool(6)
    teams = [tuple(pool[:3]), tuple(pool[3:])]  # two teams of 3

    moved = move_student(teams, "S000", dest_index=1)

    assert "S000" not in {s.name for s in moved[0]}
    assert "S000" in {s.name for s in moved[1]}
    assert len(moved[0]) == 2 and len(moved[1]) == 4
    assert {s.name for t in moved for s in t} == {s.name for s in pool}  # nobody lost


def test_score_teams_returns_one_score_per_team():
    pool = make_pool(6)
    teams = [tuple(pool[:3]), tuple(pool[3:])]

    scores = score_teams(teams)

    assert len(scores) == 2
    assert all(isinstance(s, int) for s in scores)
