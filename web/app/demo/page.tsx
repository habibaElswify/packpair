import { createAdminClient } from "@/lib/supabase/admin";
import { DemoControls } from "./demo-controls";

// PUBLIC, read-only showcase — no login. Renders the real AI-formed teams +
// reputation from the most recent sample event, so a grader/teacher can open
// one link and see the product working. Reads server-side via the admin key
// (synthetic demo data only); no real student data is exposed.

const SOLVER = process.env.NEXT_PUBLIC_SOLVER_API_URL ?? "http://localhost:8000";
const DIMS = ["participation", "communication", "technical"] as const;

type Rationale = {
  skills_covered?: string[];
  shared_availability?: number;
  shared_topics?: string[];
};

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const admin = createAdminClient();

  // The dedicated public sandbox event (is_demo) — kept separate from any real
  // class event, so the interactive demo never touches real data.
  const { data: event } = await admin
    .from("events")
    .select("id, course_label")
    .eq("is_demo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const eventId = event?.id;

  const { data: members } = eventId
    ? await admin.from("event_members").select("id, roster_name").eq("event_id", eventId)
    : { data: [] as { id: string; roster_name: string }[] };
  const nameById = new Map((members ?? []).map((m) => [m.id, m.roster_name]));

  const { data: teams } = eventId
    ? await admin.from("teams").select("id, label, score, rationale").eq("event_id", eventId).order("label")
    : { data: [] as { id: string; label: string; score: number; rationale: Rationale }[] };
  const { data: tms } = await admin.from("team_members").select("team_id, member_id");
  const byTeam = new Map<string, string[]>();
  for (const tm of tms ?? []) {
    if (!teams?.some((t) => t.id === tm.team_id)) continue;
    const l = byTeam.get(tm.team_id) ?? [];
    l.push(nameById.get(tm.member_id) ?? "—");
    byTeam.set(tm.team_id, l);
  }

  // Reputation from this event's ratings.
  const { data: ratings } = eventId
    ? await admin.from("ratings").select("subject_member_id, dimension, stars").eq("event_id", eventId)
    : { data: [] as { subject_member_id: string; dimension: string; stars: number }[] };
  let subjects: Record<string, { composite: number; by_dimension: Record<string, { public: number | null; n: number }> }> = {};
  if (ratings && ratings.length) {
    // The solver is the only thing that can be cold (free tier sleeps). Give it
    // a short timeout and fall back to showing teams without reputation, so the
    // page always loads fast instead of hanging on a cold start.
    try {
      const res = await fetch(`${SOLVER}/reputation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          k: 5,
          ratings: ratings.map((r) => ({ subject: r.subject_member_id, dimension: r.dimension, stars: r.stars })),
        }),
      });
      if (res.ok) subjects = (await res.json()).subjects ?? {};
    } catch {
      // solver cold/unavailable — render teams only
    }
  }
  const repRows = Object.entries(subjects).sort((a, b) => b[1].composite - a[1].composite).slice(0, 6);

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="flex items-center gap-3 border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 font-bold text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#ffc83d] to-[#b7a57a] text-sm font-black text-[#32235f]">
          PP
        </div>
        PackPair
        <span className="ml-2 rounded-full bg-[#ffc83d] px-2 py-0.5 text-xs font-bold text-[#32235f]">
          Live demo
        </span>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold text-[#32235f]">
          AI-formed teams — sample class
        </h1>
        <p className="mb-6 text-sm text-[#4a4a55]">
          {event?.course_label ?? "Sample event"} · formed by the CP-SAT solver,
          maximizing skill diversity, schedule overlap, and shared interests.
          Every student placed.
        </p>

        <DemoControls />

        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {(teams ?? []).map((t) => {
            const r = (t.rationale ?? {}) as Rationale;
            return (
              <div key={t.id} className="rounded-xl border border-[#e6e1ef] bg-white p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold text-[#32235f]">{t.label}</span>
                  <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-xs font-semibold text-[#7a5b00]">
                    score {t.score}
                  </span>
                </div>
                <ul className="mb-3 space-y-0.5 text-sm text-[#1b1b1f]">
                  {(byTeam.get(t.id) ?? []).map((nm, i) => (
                    <li key={i}>• {nm}</li>
                  ))}
                </ul>
                <div className="text-xs text-[#4a4a55]">
                  <div>Skills: {(r.skills_covered ?? []).join(", ") || "—"}</div>
                  <div>Shared time slots: {r.shared_availability ?? 0}</div>
                  <div>Shared interests: {(r.shared_topics ?? []).join(", ") || "—"}</div>
                </div>
              </div>
            );
          })}
        </div>

        {repRows.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-[#32235f]">Peer reputation</h2>
            <p className="mb-4 text-sm text-[#4a4a55]">
              Bayesian posteriors from peer ratings, with ratings from this
              student&apos;s past PackPair projects rolled in (this is what the
              cross-event recompute does in real classroom use). Averages shown
              only when ≥5 ratings back them (k-anonymity) — otherwise marked
              &ldquo;new.&rdquo;
            </p>
            <div className="space-y-2">
              {repRows.map(([id, rep]) => (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg border border-[#e6e1ef] bg-white px-4 py-3"
                >
                  <span className="font-medium text-[#1b1b1f]">{nameById.get(id) ?? "—"}</span>
                  <div className="flex gap-4 text-sm">
                    {DIMS.map((d) => {
                      const v = rep.by_dimension[d];
                      return (
                        <span key={d} className="text-[#4a4a55]">
                          <span className="capitalize">{d.slice(0, 4)}</span>:{" "}
                          {v?.public != null ? (
                            <strong className="text-[#32235f]">{v.public.toFixed(1)}</strong>
                          ) : (
                            <em className="text-[#b7202f]">new</em>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
