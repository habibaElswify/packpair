# Contributions

PackPair is a two-person DYOP team for **CSS 382 — Introduction to AI (Spring 2026)**, drawn directly from our weekly status decks in `~/Desktop/PackPair-Presentation/`.

---

## Aasiya Sathar  ·  ~22 hrs cumulative

### Design & schema
- **Profile schema (9-field design)** — skills, schedule (14 weekly slots), communication style, topic interests. Designed Week 1; later ported into the `student_profiles` Supabase table (`supabase/migrations/0001_schema.sql`).
- **Hi-fi mockups** for the landing, profile, and matches pages (Week 1). Established the UW-purple `#4b2e83` + UW-gold `#ffc83d` visual language used across the deployed app and `docs/`.
- **Supabase schema design + first dev SSO scaffold** (Week 2). Translated the Week-1 schema mockups into the relational model that the Week-3 RLS policies sit on top of.
- **Matches / teams page UI review** (Week 3) — feedback that shaped the team-card layout and the rationale chip rendering.
- **Rating + reputation screen design** (Week 3) — the layout used on `/events/[id]/rate` and `/events/[id]/reputation`.

### AI feedback triage & privacy layer
- **Triaged the proposal AI feedback** (cold-start + anti-gaming) and mapped each risk to a concrete code mitigation (Week 1). This is the row directly addressed by the README "risk → mitigation" table.
- **k-anonymity guard (k = 5)** on rating aggregates — `solver/privacy.py` (Week 2). The privacy claim defended by the proposal's anti-gaming concern.
- **Synthetic rating generator** for validating Bayesian + k-anonymity behavior end-to-end (Week 2).

### Demo content & writeup
- **Test-class roster data + demo walkthrough script** (Week 3) — the demo flow used during the live presentation.
- **Writeup draft** — architecture and privacy sections (Week 3).

---

## Habiba Elswify  ·  ~31 hrs cumulative

### AI core / solver
- **CP-SAT prototype** — exhaustive partition enumerator (Week 1) → **Google OR-Tools CP-SAT integer program** (`solver/cpsat_matcher.py`, Week 2) → **hardened matcher** with `flexible_range` / `strict_best_fit` / `strict_manual` remainder policies and a greedy fast-path for large rosters (`solver/matcher.py`, Week 3).
- **Bayesian Beta-prior reputation** (`solver/reputation.py`) — neutral `Beta(1,1)` prior, conjugate updates from 1–5 ratings, 95% credible intervals via `scipy.stats.beta.ppf`.

### Backend service
- **FastAPI solver microservice** (`api/`) — `/match`, `/reputation`, `/health`, `/demo/students`; Pydantic schemas; CORS for the deployed front-end; Render blueprint (`render.yaml`).

### Web app
- **Next.js 16 app** (`web/`) — Google `@uw.edu` OAuth (Supabase Auth), event flow, roster import (gradebook CSV + Canvas API), chip-based student profile, AI form-teams (calls the FastAPI solver), peer ratings, reputation dashboard, Supabase Realtime live updates, Canvas-verified instructor gate.
- **Supabase schema + RLS** (`supabase/migrations/0001`–`0004`) — every table, every policy, the new-user trigger, k-anonymity-friendly access rules.

### Deployment & ops
- **Vercel** (Next.js) + **Render** (FastAPI) + **Supabase** (Postgres + Auth + Realtime) — wired and live at <https://packpair.vercel.app> and <https://packpair-solver.onrender.com>.

---

### Notes for graders
Commit identity in the repository shows only Habiba's GitHub account because we pair-programmed and pushed from her laptop. Aasiya's design, schema, privacy code, and writeup contributions are recorded in the weekly status decks (`~/Desktop/PackPair-Presentation/PackPair_Week1.pptx`, `Week2.pptx`, `Week3.pptx`) and reflected in the file paths above.
