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
    .select("id, roster_name")
    .eq("event_id", id);
  const nameById = new Map((members ?? []).map((m) => [m.id, m.roster_name]));

  const { data: ratings } = await admin
    .from("ratings")
    .select("subject_member_id, dimension, stars")
    .eq("event_id", id);

  let subjects: Record<string, SubjectRep> = {};
  let solverUnavailable = false;
  if (ratings && ratings.length) {
    // Free-tier solver can be cold (~30s). Time out fast and surface a clear
    // state instead of hanging the page.
    try {
      const res = await fetch(`${SOLVER}/reputation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          k: 5,
          ratings: ratings.map((r) => ({
            subject: r.subject_member_id,
            dimension: r.dimension,
            stars: r.stars,
          })),
        }),
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
          Bayesian Beta posteriors from peer ratings. Averages are shown only
          when at least <strong>5 ratings</strong> back them (k-anonymity) — so
          no single rater can be identified.
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
            {ranked.map(([memberId, rep]) => (
              <div
                key={memberId}
                className="rounded-xl border border-[#e6e1ef] bg-white p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-[#1b1b1f]">
                    {nameById.get(memberId) ?? "—"}
                  </span>
                  <span className="rounded-full bg-[#efeaf7] px-3 py-1 text-xs font-semibold text-[#4b2e83]">
                    overall {(rep.composite * 5).toFixed(1)} / 5
                  </span>
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
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
