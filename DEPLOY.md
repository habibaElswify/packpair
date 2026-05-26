# PackPair — Deployment runbook

Goal: take the app from "runs locally" to a **stable public deployment** (the
25-point DYOP "Technical Execution" item). ~20–30 minutes, all free tier.

Three things go live:
1. **FastAPI solver service** → Render
2. **Next.js web app** → Vercel
3. Point them at each other + the existing Supabase project

Do them in this order.

---

## 0. One-time: push the branch + apply the realtime migration

```bash
cd ~/Projects/packpair
git push -u origin feat/backend-full        # (or merge to main first)
```

In the Supabase SQL Editor, run `supabase/migrations/0003_realtime.sql`
(enables live updates). 0001 + 0002 are already applied.

## 1. Deploy the FastAPI solver → Render

1. https://dashboard.render.com → **New → Web Service** → connect the
   `habibaElswify/packpair` repo (Render reads `render.yaml`).
2. Confirm: build `pip install -r requirements.txt`, start
   `uvicorn api.main:app --host 0.0.0.0 --port $PORT`, plan **Free**.
3. Create it. When live, copy the URL, e.g. `https://packpair-solver.onrender.com`.
4. In the service's **Environment**, set
   `PACKPAIR_CORS_ORIGINS` = your Vercel URL (fill in after step 2) — for now
   you can leave it; update once Vercel is live.
5. Verify: open `https://<your-render-url>/health` → `{"status":"ok"}`.

## 2. Deploy the Next.js app → Vercel

1. https://vercel.com → **Add New → Project** → import `habibaElswify/packpair`.
2. **Root Directory:** set to **`web`** (important — the Next app lives there).
3. **Environment Variables** (Project Settings → Environment Variables):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://skkzyervhxtgtsillkvh.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` (from `.env`) |
   | `NEXT_PUBLIC_SOLVER_API_URL` | your Render URL from step 1 |
   | `SUPABASE_SECRET_KEY` | `sb_secret_…` (from `.env`) — **not** public |
4. Deploy. Copy the production URL, e.g. `https://packpair.vercel.app`.

## 3. Wire the three together

- **Render:** set `PACKPAIR_CORS_ORIGINS` = `https://<your-vercel-url>` and
  redeploy (so the browser app may call the solver).
- **Supabase → Authentication → URL Configuration:**
  - **Site URL:** `https://<your-vercel-url>`
  - **Redirect URLs:** add `https://<your-vercel-url>/**`
- **Google Cloud → Clients → PackPair Web:** the redirect URI stays the
  Supabase callback (already set); no change needed because OAuth returns to
  Supabase, then Supabase returns to the Vercel app (allow-listed above).

## 4. Let graders in

The Google consent screen is in **Testing** mode → only test users can log in.
Choose one:
- **Add test users** (Google Cloud → Audience → Test users): add the grader's +
  classmates' `@uw.edu` emails. Simplest.
- **Publish the app** (Audience → Publish): anyone with `@uw.edu` can log in
  (shows an "unverified app" notice — fine for a class project; only basic
  email/profile scopes are requested).

## 5. Smoke test the live URL

1. Open the Vercel URL → sign in with `@uw.edu`.
2. Create an event → **Seed 12 demo students** → **Form teams** → 4 teams appear.
3. **Simulate demo ratings** → **View reputation** → Bayesian means + k-anonymity.
4. (Realtime) open the event in a second browser; form teams in the first → the
   second updates without refresh.

If all five pass, the deployment is real and stable — screenshot it for the
writeup and the Week 4 deck.

---

### Notes
- Render free tier sleeps after 15 min idle → first request after idle takes
  ~30 s (cold start). Fine for a demo; mention it if asked.
- Supabase free project pauses after ~1 week idle → one click to resume.
- The `SUPABASE_SECRET_KEY` lives only in Render-side... no — it's used by the
  Next.js **server** actions, so it goes in **Vercel** (server env, not
  `NEXT_PUBLIC`). It is never shipped to the browser.
