"""k-anonymity guard on rating aggregates.

Anti-gaming mitigation from the proposal AI feedback: 3-person team
ratings are re-identifiable, so any aggregate exposed to the system
(or to other users) must be backed by at least `k` independent
ratings within a rolling window.

If the window has fewer than `k` ratings, the aggregate is suppressed
(returns None). This prevents a single rater from being inferred even
when teams are small.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, Optional, Tuple


DEFAULT_K = 5
DEFAULT_WINDOW = 50  # most recent N ratings per student


@dataclass
class RollingAggregator:
    k: int = DEFAULT_K
    window: int = DEFAULT_WINDOW
    _buf: Dict[Tuple[str, str], Deque[float]] = field(default_factory=dict)

    def record(self, subject: str, dimension: str, rating: float) -> None:
        key = (subject, dimension)
        if key not in self._buf:
            self._buf[key] = deque(maxlen=self.window)
        self._buf[key].append(rating)

    def aggregate(self, subject: str, dimension: str) -> Optional[float]:
        """Return rolling mean rating, or None if below k-anonymity threshold."""
        buf = self._buf.get((subject, dimension))
        if buf is None or len(buf) < self.k:
            return None
        return sum(buf) / len(buf)

    def count(self, subject: str, dimension: str) -> int:
        return len(self._buf.get((subject, dimension), ()))

    def is_disclosable(self, subject: str, dimension: str) -> bool:
        return self.count(subject, dimension) >= self.k


def public_view(
    aggregator: RollingAggregator,
    subject: str,
    dimensions: Tuple[str, ...],
) -> Dict[str, Optional[float]]:
    """Return the k-anonymous public view for a student across dimensions.

    Each value is either the rolling mean (when k-anonymity is met) or
    None (suppressed). UI shows "Not enough ratings yet" for None.
    """
    return {d: aggregator.aggregate(subject, d) for d in dimensions}
