import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveRatings } from "@/app/actions";

const DIMS = ["participation", "communication", "technical"] as const;

export default async function RatePage({
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
  const me = (members ?? []).find((m) => m.user_id === user.id);
  if (!me) redirect(`/events/${id}`);

  // Find my team and my teammates.
  const { data: teamMembers } = await admin
    .from("team_members")
    .select("team_id, member_id");
  const myTeamId = (teamMembers ?? []).find((tm) => tm.member_id === me.id)?.team_id;
  const teammates = (teamMembers ?? [])
    .filter((tm) => tm.team_id === myTeamId && tm.member_id !== me.id)
    .map((tm) => tm.member_id);

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <Link href={`/events/${id}`} className="text-sm opacity-90 hover:opacity-100">
          ← Back to event
        </Link>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-[#32235f]">Rate your teammates</h1>
        <p className="mb-6 text-sm text-[#4a4a55]">
          Anonymous · 1–5 on each dimension. Feeds the reputation model for
          future matches.
        </p>

        {!myTeamId || teammates.length === 0 ? (
          <p className="text-sm text-[#4a4a55]">
            You don&apos;t have a team to rate yet.
          </p>
        ) : (
          <form action={saveRatings.bind(null, id)} className="space-y-5">
            {teammates.map((tid) => (
              <div
                key={tid}
                className="rounded-xl border border-[#e6e1ef] bg-white p-5"
              >
                <div className="mb-3 font-semibold text-[#1b1b1f]">
                  {nameById.get(tid) ?? "—"}
                </div>
                <div className="space-y-2">
                  {DIMS.map((d) => (
                    <div key={d} className="flex items-center justify-between">
                      <span className="text-sm capitalize text-[#4a4a55]">{d}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label key={n} className="cursor-pointer">
                            <input
                              type="radio"
                              name={`rating-${tid}-${d}`}
                              value={n}
                              defaultChecked={n === 3}
                              className="peer sr-only"
                            />
                            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#d8cfe9] text-sm transition peer-checked:border-[#4b2e83] peer-checked:bg-[#4b2e83] peer-checked:text-white">
                              {n}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="submit"
              className="rounded-lg bg-[#4b2e83] px-5 py-2.5 font-semibold text-white transition hover:bg-[#32235f]"
            >
              Submit ratings
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
