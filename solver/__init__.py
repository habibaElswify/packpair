"""PackPair solver package — CP-SAT team matcher, Bayesian reputation,
k-anonymity guard. All three AI layers from the proposal live here.
"""

from .cpsat_matcher import base_team_score, solve
from .privacy import RollingAggregator, public_view
from .reputation import (
    BetaPosterior,
    DIMENSIONS,
    ReputationStore,
    StudentReputation,
    simulate_ratings,
)
from .students import MOCK_POOL, Student, synthetic_pool

__all__ = [
    "base_team_score",
    "solve",
    "RollingAggregator",
    "public_view",
    "BetaPosterior",
    "DIMENSIONS",
    "ReputationStore",
    "StudentReputation",
    "simulate_ratings",
    "MOCK_POOL",
    "Student",
    "synthetic_pool",
]
