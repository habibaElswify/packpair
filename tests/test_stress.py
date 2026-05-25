"""Stress + edge-case coverage for the matcher.

The platform's central promise is "every student ends up in a group." These
tests hammer that invariant across roster sizes, degenerate profiles, and a
realistic large class, plus the straggler (neutral-profile) path.
"""

from __future__ import annotations

import pytest

from solver.matcher import form_teams
from solver.students import Student, fs, fi, neutral_student, synthetic_pool


def make_pool(n: int):
    return [
        Student(f"S{i:03d}", fs("a", "b"), fi(0, 1, 2), "sync", fs("ai"))
        for i in range(n)
    ]


def names_of(result):
    return {s.name for team in result.teams for s in team}


def test_neutral_student_is_still_placed():
    # A straggler with no profile gets a neutral default and must still match.
    pool = make_pool(5) + [neutral_student("STRAGGLER")]
    result = form_teams(
        pool, target_size=3, remainder_policy="flexible_range", min_size=2, max_size=4
    )
    assert "STRAGGLER" in names_of(result)
    assert len(names_of(result)) == 6


# --- coverage invariant across every remainder, for every policy -------------

@pytest.mark.parametrize("n", [9, 10, 11, 12, 13, 14])
def test_flexible_range_covers_everyone_for_any_size(n):
    pool = make_pool(n)
    result = form_teams(
        pool, target_size=3, remainder_policy="flexible_range", min_size=2, max_size=4
    )
    assert names_of(result) == {s.name for s in pool}
    assert result.unplaced == []
    assert all(2 <= len(t) <= 4 for t in result.teams)


@pytest.mark.parametrize("n", [9, 10, 11, 12, 13, 14])
def test_strict_best_fit_covers_everyone_no_team_below_target(n):
    pool = make_pool(n)
    result = form_teams(pool, target_size=3, remainder_policy="strict_best_fit")
    assert names_of(result) == {s.name for s in pool}
    assert result.unplaced == []
    assert len(result.teams) == n // 3
    assert all(len(t) >= 3 for t in result.teams)


@pytest.mark.parametrize("n", [9, 10, 11, 12, 13, 14])
def test_strict_manual_leftovers_equal_remainder(n):
    pool = make_pool(n)
    result = form_teams(pool, target_size=3, remainder_policy="strict_manual")
    assert len(result.unplaced) == n % 3
    assert all(len(t) == 3 for t in result.teams)
    # placed + unplaced = everyone, exactly once
    placed_and_left = names_of(result) | {s.name for s in result.unplaced}
    assert placed_and_left == {s.name for s in pool}


# --- realistic large class + degenerate inputs -------------------------------

def test_thirty_student_class_places_everyone_quickly():
    # A realistic varied 30-student class (the common UW size).
    pool = synthetic_pool(30)
    result = form_teams(pool, target_size=3, remainder_policy="strict_best_fit")
    assert names_of(result) == {s.name for s in pool}
    assert len(result.teams) == 10
    assert result.elapsed_s < 5.0  # snappy enough for a live teacher action


def test_disjoint_availability_still_places_everyone():
    # Every student free in a different single slot -> no schedule overlap at all.
    pool = [
        Student(f"D{i:03d}", fs("x"), fi(i % 14), "async", fs("t"))
        for i in range(9)
    ]
    result = form_teams(
        pool, target_size=3, remainder_policy="flexible_range", min_size=2, max_size=4
    )
    assert names_of(result) == {s.name for s in pool}


def test_reputation_bonus_preserves_full_coverage():
    pool = make_pool(9)
    result = form_teams(
        pool,
        target_size=3,
        remainder_policy="strict_best_fit",
        reputation_bonus=lambda team: 7,  # constant per-team bonus
    )
    assert names_of(result) == {s.name for s in pool}
    assert result.unplaced == []
