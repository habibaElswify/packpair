"""Shared Student dataclass and mock pool used by the solver + reputation modules."""

from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet, List


@dataclass(frozen=True)
class Student:
    name: str
    skills: FrozenSet[str]
    available: FrozenSet[int]
    comm_style: str
    topics: FrozenSet[str]


def fs(*items: str) -> FrozenSet[str]:
    return frozenset(items)


def fi(*items: int) -> FrozenSet[int]:
    return frozenset(items)


MOCK_POOL: List[Student] = [
    Student("Alex Chen",     fs("frontend", "design"),         fi(0, 1, 2, 8, 9),       "sync",  fs("ai", "web")),
    Student("Maya Patel",    fs("backend", "databases"),       fi(1, 2, 3, 8, 9, 10),   "async", fs("ai", "infra")),
    Student("Jordan Kim",    fs("ml", "python"),               fi(0, 2, 3, 9, 10),      "async", fs("ai", "nlp")),
    Student("Sara Ahmed",    fs("frontend", "ml"),             fi(2, 3, 4, 10, 11),     "sync",  fs("web", "nlp")),
    Student("Diego Lopez",   fs("backend", "devops"),          fi(3, 4, 5, 11, 12),     "mixed", fs("infra", "security")),
    Student("Priya Shah",    fs("ml", "math"),                 fi(4, 5, 6, 12, 13),     "async", fs("ai", "research")),
    Student("Ethan Wright",  fs("design", "writing"),          fi(0, 1, 5, 8, 13),      "sync",  fs("web", "ux")),
    Student("Yuki Tanaka",   fs("python", "databases"),        fi(2, 3, 9, 10, 11),     "async", fs("infra", "nlp")),
    Student("Noor Hassan",   fs("frontend", "writing"),        fi(1, 2, 8, 9, 10),      "mixed", fs("ux", "web")),
    Student("Liam OBrien",   fs("ml", "backend"),              fi(3, 4, 10, 11, 12),    "async", fs("research", "ai")),
    Student("Aria Rossi",    fs("design", "python"),           fi(0, 4, 5, 8, 12, 13),  "sync",  fs("ux", "ai")),
    Student("Tomas Silva",   fs("devops", "math"),             fi(5, 6, 11, 12, 13),    "mixed", fs("security", "research")),
]


def neutral_student(name: str) -> Student:
    """A straggler who never filled a profile.

    Used by the ``neutral_default`` straggler policy: no skills or topics to
    contribute, maximally available (so they fit anywhere), neutral comm style.
    They carry no signal but are always placeable.
    """
    return Student(name, fs(), fi(*range(14)), "mixed", fs())


def synthetic_pool(n: int, seed: int = 7) -> List[Student]:
    """Deterministic synthetic roster of n students for scaling tests."""
    import random

    rng = random.Random(seed)
    skills = ["frontend", "backend", "databases", "ml", "design", "python",
              "devops", "math", "writing"]
    topics = ["ai", "web", "infra", "nlp", "ux", "security", "research"]
    styles = ["sync", "async", "mixed"]
    pool: List[Student] = []
    for i in range(n):
        pool.append(Student(
            name=f"S{i:03d}",
            skills=frozenset(rng.sample(skills, k=rng.randint(2, 3))),
            available=frozenset(rng.sample(range(14), k=rng.randint(4, 7))),
            comm_style=rng.choice(styles),
            topics=frozenset(rng.sample(topics, k=2)),
        ))
    return pool
