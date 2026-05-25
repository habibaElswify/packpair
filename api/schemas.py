"""Pydantic request/response models for the solver service."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class StudentIn(BaseModel):
    name: str
    skills: List[str] = Field(default_factory=list)
    availability: List[int] = Field(default_factory=list)
    comm_style: str = "mixed"
    topics: List[str] = Field(default_factory=list)


class MatchRequest(BaseModel):
    students: List[StudentIn]
    target_size: int = 3
    remainder_policy: str = "strict_best_fit"
    min_size: Optional[int] = None
    max_size: Optional[int] = None
    time_limit_s: float = 10.0


class TeamRationale(BaseModel):
    skills_covered: List[str]
    shared_availability: int
    shared_topics: List[str]
    comm_styles: List[str]


class TeamOut(BaseModel):
    members: List[str]
    size: int
    score: int
    rationale: TeamRationale


class MatchResponse(BaseModel):
    teams: List[TeamOut]
    unplaced: List[str]
    total_score: int
    elapsed_ms: float


class RatingIn(BaseModel):
    subject: str
    dimension: str
    stars: float


class ReputationRequest(BaseModel):
    ratings: List[RatingIn]
    k: int = 5


class DimensionView(BaseModel):
    mean: float
    ci_low: float
    ci_high: float
    n: int
    public: Optional[float]  # k-anonymous rolling mean, or None if suppressed


class SubjectReputation(BaseModel):
    composite: float
    by_dimension: dict[str, DimensionView]


class ReputationResponse(BaseModel):
    subjects: dict[str, SubjectReputation]
