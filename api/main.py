"""PackPair solver microservice — the AI brain.

A thin FastAPI layer over the ``solver/`` package. The Next.js app calls this
to form teams and to query reputation; all matching/Bayesian/k-anonymity logic
lives in ``solver/`` and is reused verbatim.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import (
    DimensionView,
    MatchRequest,
    MatchResponse,
    ReputationRequest,
    ReputationResponse,
    SubjectReputation,
    TeamOut,
    TeamRationale,
)
from solver.matcher import Team, form_teams, score_teams
from solver.privacy import RollingAggregator
from solver.reputation import ReputationStore
from solver.students import Student, synthetic_pool

app = FastAPI(title="PackPair Solver", version="1.0.0")

# Browser clients (Next.js dev + the deployed front-end) call this directly.
# Origins are configurable via PACKPAIR_CORS_ORIGINS (comma-separated).
_default_origins = "http://localhost:3000,https://habibaelswify.github.io"
_origins = os.getenv("PACKPAIR_CORS_ORIGINS", _default_origins).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {
        "service": "PackPair Solver",
        "status": "ok",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/demo/students")
def demo_students(n: int = 12, seed: int = 7) -> dict:
    """Synthetic roster for seeding a Demo Class (testing + demo without
    needing real signups). Reuses the same generator the solver tests use."""
    pool = synthetic_pool(n, seed=seed)
    return {
        "students": [
            {
                "name": s.name,
                "skills": sorted(s.skills),
                "availability": sorted(s.available),
                "comm_style": s.comm_style,
                "topics": sorted(s.topics),
            }
            for s in pool
        ]
    }


def _rationale(team: Team) -> TeamRationale:
    skills: set = set()
    shared_slots = set(team[0].available)
    shared_topics = set(team[0].topics)
    styles = set()
    for s in team:
        skills |= s.skills
        shared_slots &= s.available
        shared_topics &= s.topics
        styles.add(s.comm_style)
    return TeamRationale(
        skills_covered=sorted(skills),
        shared_availability=len(shared_slots),
        shared_topics=sorted(shared_topics),
        comm_styles=sorted(styles),
    )


@app.post("/match", response_model=MatchResponse)
def match(req: MatchRequest) -> MatchResponse:
    pool = [
        Student(
            name=s.name,
            skills=frozenset(s.skills),
            available=frozenset(s.availability),
            comm_style=s.comm_style,
            topics=frozenset(s.topics),
        )
        for s in req.students
    ]
    result = form_teams(
        pool,
        target_size=req.target_size,
        remainder_policy=req.remainder_policy,
        min_size=req.min_size,
        max_size=req.max_size,
        time_limit_s=req.time_limit_s,
    )
    scores = score_teams(result.teams)
    teams = [
        TeamOut(
            members=[s.name for s in team],
            size=len(team),
            score=scores[i],
            rationale=_rationale(team),
        )
        for i, team in enumerate(result.teams)
    ]
    return MatchResponse(
        teams=teams,
        unplaced=[s.name for s in result.unplaced],
        total_score=result.score,
        elapsed_ms=round(result.elapsed_s * 1000, 1),
    )


@app.post("/reputation", response_model=ReputationResponse)
def reputation(req: ReputationRequest) -> ReputationResponse:
    store = ReputationStore()
    agg = RollingAggregator(k=req.k)
    for r in req.ratings:
        store.record(r.subject, r.dimension, r.stars)
        agg.record(r.subject, r.dimension, r.stars)

    subjects: dict = {}
    for name in {r.subject for r in req.ratings}:
        summary = store.summary(name)
        by_dim = {
            dim: DimensionView(
                mean=stats["mean"],
                ci_low=stats["ci_low"],
                ci_high=stats["ci_high"],
                n=stats["n"],
                public=agg.aggregate(name, dim),  # None when below k
            )
            for dim, stats in summary.items()
        }
        subjects[name] = SubjectReputation(
            composite=store.composite(name), by_dimension=by_dim
        )
    return ReputationResponse(subjects=subjects)
