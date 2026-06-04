import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SOLVER = process.env.NEXT_PUBLIC_SOLVER_API_URL ?? "http://localhost:8000";
const DIMS = ["participation", "communication", "technical"] as const;

type DimView = {
  mean: number;
  ci_low: number;
  ci_high: number;
  n: number;
  public: number | null;
};
type SubjectRep = { composite: number; by_dimension: Record<string, DimView> };

export default async function ReputationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: event } = await supabase
    .from("events")
    .select("id, course_label")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("event_members")
    .select("id, roster_name, user_id")
    .eq("event_id", id);
  const nameById = new Map((members ?? []).map((m) => [m.id, m.roster_name]));

  // Cross-event accumulation: for every member of THIS event who has a UW
  // identity, also pull their ratings from every OTHER event they're in.
  // We pass them all to the solver keyed by this-event member_id so the
  // page displays correctly, but the rating COUNT (and therefore the
  // k-anonymity decision) reflects each student's full PackPair history.
  // This is the same accumulation rebuildReputationForEvent persists into
  // the `reputation` table; doing it again here keeps the page in sync
  // with the persistent posterior.
  const userIdByMember = new Map(
    (members ?? [])
      .filter((m) => m.user_id)
      .map((m) => [m.id, m.user_id as string]),
  );
  const userIds = [...new Set(userIdByMember.values())];

  let allSeats: { id: string; user_id: string }[] = [];
  if (userIds.length > 0) {
    const { data } = await admin
      .from("event_members")
      .select("id, user_id")
      .in("user_id", userIds);
    allSeats = (data ?? []) as { id: string; user_id: string }[];
  }
  const seatToUser = new Map(allSeats.map((s) => [s.id, s.user_id]));
  const memberIdByUser = new Map<string, string>();
  for (const [mid, uid] of userIdByMember.entries()) memberIdByUser.set(uid, mid);

  // ALL ratings ever received by any current-event member, in any event.
  const seatIds = allSeats.map((s) => s.id);
  const { data: ratings } = seatIds.length
    ? await admin
        .from("ratings")
        .select("subject_member_id, dimension, stars")
        .in("subject_member_id", seatIds)
    : { data: [] as { subject_member_id: string; dimension: string; stars: number }[] };

  // Also include this event's ratings of NON-joined roster members (e.g. seeded
  // demo students that never had a user_id) so the page still renders them.
  const { data: localOnly } = await admin
    .from("ratings")
    .select("subject_member_id, dimension, stars")
    .eq("event_id", id);
  const memberIds = new Set((members ?? []).map((m) => m.id));
  for (const r of localOnly ?? []) {
    if (!seatToUser.has(r.subject_member_id) && memberIds.has(r.subject_member_id)) {
      (ratings ?? []).push(r);
    }
  }

  let subjects: Record<string, SubjectRep> = {};
  let solverUnavailable = false;
  if (ratings && ratings.length) {
    // Re-key cross-event ratings to THIS event's member_id so the UI maps
    // back to a name we can render.
    const payload = ratings.map((r) => {
      const uid = seatToUser.get(r.subject_member_id);
      const subject =
        uid && memberIdByUser.has(uid)
          ? memberIdByUser.get(uid)!
          : r.subject_member_id;
      return { subject, dimension: r.dimension, stars: r.stars };
    });
    try {
      const res = await fetch(`${SOLVER}/reputation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({ k: 5, ratings: payload }),
      });
      if (res.ok) subjects = (await res.json()).subjects ?? {};
      else solverUnavailable = true;
    } catch {
      solverUnavailable = true;
    }
  }

  const ranked = Object.entries(subjects).sort(
    (a, b) => b[1].composite - a[1].composite,
  );

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <Link href={`/events/${id}`} className="text-sm opacity-90 hover:opacity-100">
          ← Back to event
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold text-[#32235f]">Peer reputation</h1>
        <p className="mb-6 text-sm text-[#4a4a55]">
          Bayesian Beta posteriors from peer ratings. Ratings accumulate
          across every PackPair event a student is in — the counts below
          include their full history, not just this class. Averages are
          shown only when at least <strong>5 ratings</strong> back them
          (k-anonymity) — so no single rater can be identified.
        </p>

        {ranked.length === 0 ? (
          solverUnavailable ? (
            <div className="rounded-lg border border-[#fde7d6] bg-[#fff8ef] p-4 text-sm text-[#7a5b00]">
              The AI service is waking up from idle (free-tier cold start, ~30s).
              Refresh in a moment — reputation will appear.
            </div>
          ) : (
            <p className="text-sm text-[#4a4a55]">
              No ratings yet. Once peer review opens and teammates rate each
              other, reputation appears here.
            </p>
          )
        ) : (
          <div className="space-y-3">
            {ranked.map(([memberId, rep]) => {
              // The composite is k-anon-gated TOO — if no dimension has
              // enough ratings to disclose, hiding per-dim while showing a
              // composite would be inconsistent (and a small privacy leak).
              const totalN = DIMS.reduce(
                (s, d) => s + (rep.by_dimension[d]?.n ?? 0),
                0,
              );
              const anyDisclosable = DIMS.some(
                (d) => rep.by_dimension[d]?.public != null,
              );
              return (
              <div
                key={memberId}
                className="rounded-xl border border-[#e6e1ef] bg-white p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-[#1b1b1f]">
                    {nameById.get(memberId) ?? "—"}
                  </span>
                  {anyDisclosable ? (
                    <span className="rounded-full bg-[#efeaf7] px-3 py-1 text-xs font-semibold text-[#4b2e83]">
                      overall {(rep.composite * 5).toFixed(1)} / 5
                    </span>
                  ) : (
                    <span
                      className="rounded-full bg-[#fff3d6] px-3 py-1 text-xs font-medium text-[#7a5b00]"
                      title="k-anonymity: composite suppressed until at least one dimension has ≥5 ratings (across all PackPair events)"
                    >
                      gathering ratings · {totalN} of 15
                    </span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {DIMS.map((d) => {
                    const v = rep.by_dimension[d];
                    const disclosable = v?.public != null;
                    return (
                      <div key={d} className="rounded-lg bg-[#f7f5fb] p-3">
                        <div className="text-xs font-medium capitalize text-[#4a4a55]">
                          {d}
                        </div>
                        {disclosable ? (
                          <>
                            <div className="text-lg font-bold text-[#32235f]">
                              {(v.public! ).toFixed(2)}
                              <span className="text-xs font-normal text-[#4a4a55]">
                                {" "}
                                / 5
                              </span>
                            </div>
                            <div className="text-[11px] text-[#4a4a55]">
                              {v.n} ratings · Bayesian mean{" "}
                              {(v.mean * 5).toFixed(2)}
                            </div>
                            {/* 95% credible interval bar (wider = less data) */}
                            <div
                              className="relative mt-1 h-1.5 rounded-full bg-[#efeaf7]"
                              title={`95% CI: ${(v.ci_low * 5).toFixed(2)} – ${(v.ci_high * 5).toFixed(2)} / 5`}
                            >
                              <div
                                className="absolute h-1.5 rounded-full bg-[#b7a57a]"
                                style={{
                                  left: `${v.ci_low * 100}%`,
                                  width: `${(v.ci_high - v.ci_low) * 100}%`,
                                }}
                              />
                              <div
                                className="absolute -top-0.5 h-2.5 w-0.5 bg-[#4b2e83]"
                                style={{ left: `${v.mean * 100}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="mt-1 text-xs italic text-[#b7202f]">
                            need 5 ratings to disclose (have {v?.n ?? 0})
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
