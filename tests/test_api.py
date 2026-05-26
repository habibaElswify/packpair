"""Integration tests for the FastAPI solver service (the AI brain)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_root_returns_service_info():
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "PackPair Solver"
    assert "/health" in body.values()


def test_health_returns_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_cors_allows_browser_origin():
    # The Next.js front-end calls this API from the browser, so CORS must
    # echo an allowed origin back.
    resp = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def roster(n: int):
    return [
        {
            "name": f"S{i:03d}",
            "skills": ["a", "b"],
            "availability": [0, 1, 2],
            "comm_style": "sync",
            "topics": ["ai"],
        }
        for i in range(n)
    ]


def test_match_forms_teams_covering_everyone():
    resp = client.post(
        "/match",
        json={
            "students": roster(10),
            "target_size": 3,
            "remainder_policy": "strict_best_fit",
        },
    )
    assert resp.status_code == 200
    data = resp.json()

    placed = {m for team in data["teams"] for m in team["members"]}
    assert placed == {s["name"] for s in roster(10)}
    assert len(data["teams"]) == 3
    assert data["unplaced"] == []
    assert all(isinstance(t["score"], int) for t in data["teams"])
    assert "rationale" in data["teams"][0]


def test_match_returns_leftovers_under_strict_manual():
    resp = client.post(
        "/match",
        json={
            "students": roster(10),
            "target_size": 3,
            "remainder_policy": "strict_manual",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["unplaced"]) == 1
    assert len(data["teams"]) == 3


def test_demo_students_returns_varied_roster():
    resp = client.get("/demo/students?n=12")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["students"]) == 12
    s = data["students"][0]
    assert set(s.keys()) >= {"name", "skills", "availability", "comm_style", "topics"}
    # varied, not all identical
    assert len({tuple(sorted(x["skills"])) for x in data["students"]}) > 1


def test_reputation_summarizes_and_suppresses_below_k():
    ratings = [
        {"subject": "HIGH", "dimension": "participation", "stars": 5}
        for _ in range(6)
    ] + [
        {"subject": "LOW", "dimension": "participation", "stars": 4}
        for _ in range(2)
    ]
    resp = client.post("/reputation", json={"ratings": ratings, "k": 5})
    assert resp.status_code == 200
    data = resp.json()

    high = data["subjects"]["HIGH"]["by_dimension"]["participation"]
    low = data["subjects"]["LOW"]["by_dimension"]["participation"]
    assert high["n"] == 6
    assert high["public"] is not None  # >= k ratings -> disclosable
    assert low["public"] is None  # < k ratings -> suppressed (k-anonymity)
    assert 0.0 <= data["subjects"]["HIGH"]["composite"] <= 1.0
