"""Bayesian Beta-prior reputation model.

Each student has, per rating dimension (participation, communication,
technical), a Beta(alpha, beta) posterior over a [0, 1] "quality"
parameter. New students start with the neutral prior Beta(1, 1) — this
is the cold-start mitigation called out in the proposal feedback.

Ratings on a 1-5 scale are mapped to Bernoulli-like evidence: a rating
of r contributes (r - 1) / 4 successes and 1 - (r - 1) / 4 failures.
The posterior is updated by simple conjugacy.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Tuple

from scipy.stats import beta as scipy_beta

DIMENSIONS = ("participation", "communication", "technical")


@dataclass
class BetaPosterior:
    alpha: float = 1.0
    beta: float = 1.0

    def update(self, rating: float) -> None:
        """Update with a 1-5 rating. Successes = (r - 1) / 4."""
        if not 1.0 <= rating <= 5.0:
            raise ValueError(f"rating {rating} out of 1-5 range")
        s = (rating - 1.0) / 4.0
        self.alpha += s
        self.beta += 1.0 - s

    @property
    def mean(self) -> float:
        return self.alpha / (self.alpha + self.beta)

    def credible_interval(self, level: float = 0.95) -> Tuple[float, float]:
        lo = (1.0 - level) / 2.0
        hi = 1.0 - lo
        return (
            float(scipy_beta.ppf(lo, self.alpha, self.beta)),
            float(scipy_beta.ppf(hi, self.alpha, self.beta)),
        )

    def n_observations(self) -> int:
        # alpha + beta - 2 = total evidence added (prior was 1,1)
        return int(round(self.alpha + self.beta - 2.0))


@dataclass
class StudentReputation:
    name: str
    by_dim: Dict[str, BetaPosterior] = field(
        default_factory=lambda: {d: BetaPosterior() for d in DIMENSIONS}
    )

    def record_rating(self, dim: str, rating: float) -> None:
        if dim not in DIMENSIONS:
            raise ValueError(f"unknown dimension {dim!r}; expected one of {DIMENSIONS}")
        self.by_dim[dim].update(rating)

    def composite(self) -> float:
        """Equal-weight mean across the three dimensions."""
        return sum(self.by_dim[d].mean for d in DIMENSIONS) / len(DIMENSIONS)


class ReputationStore:
    """In-memory store of per-student Beta posteriors.

    The production deployment will back this with Supabase rows; the API
    surface is the same.
    """

    def __init__(self) -> None:
        self._by_name: Dict[str, StudentReputation] = {}

    def get(self, name: str) -> StudentReputation:
        if name not in self._by_name:
            self._by_name[name] = StudentReputation(name=name)
        return self._by_name[name]

    def record(self, name: str, dim: str, rating: float) -> None:
        self.get(name).record_rating(dim, rating)

    def composite(self, name: str) -> float:
        return self.get(name).composite()

    def team_bonus(
        self,
        team_names: Iterable[str],
        *,
        weight: int = 20,
        smoothing: int = 4,
    ) -> int:
        """Integer bonus for the team's mean composite — fed to CP-SAT.

        Confidence-weighted: each student's composite is shrunk toward the
        neutral 0.5 prior by `smoothing / (smoothing + n_observations)`, so a
        student with very few ratings can't swing the objective on noise.
        `smoothing=4` is one less than the k-anonymity threshold (k=5), so
        students cross the "ratings displayed publicly" line at roughly the
        same point they start meaningfully moving the bonus.

        The bonus is bounded in [0, weight].
        """
        names = list(team_names)
        if not names:
            return 0
        total = 0.0
        for n in names:
            rep = self.get(n)
            shrunk_dims = []
            for dim, post in rep.by_dim.items():
                n_obs = post.n_observations()
                w = n_obs / (n_obs + smoothing)
                shrunk_dims.append(w * post.mean + (1 - w) * 0.5)
            total += sum(shrunk_dims) / len(shrunk_dims)
        m = total / len(names)
        return int(round(weight * m))

    def summary(self, name: str) -> Dict[str, Dict[str, float]]:
        rep = self.get(name)
        return {
            dim: {
                "mean": post.mean,
                "ci_low": post.credible_interval()[0],
                "ci_high": post.credible_interval()[1],
                "n": post.n_observations(),
            }
            for dim, post in rep.by_dim.items()
        }


def simulate_ratings(store: ReputationStore, name: str,
                     true_quality: float, n: int, seed: int = 0) -> None:
    """Generate `n` synthetic 1-5 ratings for `name` whose mean tracks
    `true_quality` in [0, 1]. Used to validate posterior behaviour."""
    import random

    rng = random.Random(seed)
    for _ in range(n):
        # Map quality [0,1] to a noisy 1-5 rating.
        noisy = max(0.0, min(1.0, true_quality + rng.gauss(0, 0.15)))
        rating = 1.0 + 4.0 * noisy
        for dim in DIMENSIONS:
            store.record(name, dim, rating)
