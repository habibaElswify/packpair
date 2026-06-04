"""Confidence-weighted Bayesian reputation tests.

Pisan-Suggest item: shrink low-evidence reputation bonuses toward neutral so
the CP-SAT objective is robust to noise when n_observations is small.
"""

from solver.reputation import ReputationStore


def test_team_bonus_for_new_student_is_neutral():
    """A student with zero ratings has prior Beta(1,1) → mean 0.5.
    A team of one new student should produce a half-weight bonus.
    """
    store = ReputationStore()
    bonus = store.team_bonus(["Newbie"], weight=20)
    assert bonus == 10, f"expected neutral (10), got {bonus}"


def test_team_bonus_shrinks_low_evidence_toward_neutral():
    """A single 5-star rating produces posterior mean 0.667 — but n=1 is
    flimsy evidence. Confidence weighting should pull the bonus back toward
    the 0.5 neutral so a noisy single rating can't dominate team formation.
    """
    naive = ReputationStore()
    naive.record("Bob", "participation", 5)
    naive.record("Bob", "communication", 5)
    naive.record("Bob", "technical", 5)
    # Naive composite ≈ 0.667 → naive bonus ≈ 13 (= round(20 * 0.667))
    bonus = naive.team_bonus(["Bob"], weight=20)
    # Confidence-weighted: with only n=1 per dimension, bonus should land
    # strictly between neutral (10) and naive (13), shrunken toward neutral.
    assert 10 < bonus < 13, (
        f"expected confidence-shrunk bonus in (10, 13), got {bonus}"
    )


def test_team_bonus_high_evidence_stays_close_to_naive():
    """With many ratings the confidence weighting should converge back to
    the posterior mean — so a well-evidenced top performer still gets the
    near-full bonus, not perpetually punished by the shrinkage prior.
    """
    store = ReputationStore()
    for _ in range(40):
        store.record("Carol", "participation", 5)
        store.record("Carol", "communication", 5)
        store.record("Carol", "technical", 5)
    bonus = store.team_bonus(["Carol"], weight=20)
    # Posterior mean per dim ≈ 41/42 ≈ 0.976; naive bonus ≈ 20.
    # With high n the shrinkage should leave the bonus within 1 of naive.
    assert bonus >= 18, f"expected ≥18 with strong evidence, got {bonus}"


def test_team_bonus_mixed_team_averages_confidence_per_member():
    """A team of one heavily-rated student + one new student should land
    between the two individual bonuses — never above the heavily-rated one,
    never below neutral.
    """
    store = ReputationStore()
    for _ in range(40):
        store.record("Veteran", "participation", 5)
        store.record("Veteran", "communication", 5)
        store.record("Veteran", "technical", 5)
    veteran_bonus = store.team_bonus(["Veteran"], weight=20)
    new_bonus = store.team_bonus(["Newbie"], weight=20)
    mixed = store.team_bonus(["Veteran", "Newbie"], weight=20)
    assert new_bonus <= mixed <= veteran_bonus
