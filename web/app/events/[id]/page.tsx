import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherControls } from "./teacher-controls";
import { RealtimeRefresh } from "./realtime-refresh";

type Rationale = {
  skills_covered?: string[];
  shared_availability?: number;
  shared_topics?: string[];
  comm_styles?: string[];
};

export default async function EventPage({
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
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const isOwner = event.owner_id === user.id;

  const { data: members } = await supabase
    .from("event_members")
    .select("id, roster_name, roster_email, role, user_id")
    .eq("event_id", id);
  const students = (members ?? []).filter((m) => m.role === "student");
  const joinedCount = students.filter((m) => m.user_id).length;
  const nameById = new Map((members ?? []).map((m) => [m.id, m.roster_name]));
  const myMember = (members ?? []).find((m) => m.user_id === user.id);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, label, score, rationale")
    .eq("event_id", id)
    .order("label");
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("team_id, member_id");
  const membersByTeam = new Map<string, string[]>();
  const memberIdsByTeam = new Map<string, string[]>();
  for (const tm of teamMembers ?? []) {
    const names = membersByTeam.get(tm.team_id) ?? [];
    names.push(nameById.get(tm.member_id) ?? "—");
    membersByTeam.set(tm.team_id, names);
    const ids = memberIdsByTeam.get(tm.team_id) ?? [];
    ids.push(tm.member_id);
    memberIdsByTeam.set(tm.team_id, ids);
  }

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <RealtimeRefresh eventId={id} />
      <header className="border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <Link href="/" className="text-sm opacity-90 hover:opacity-100">
          ← Back to events
        </Link>
      </header>

      <section className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-bold text-[#32235f]">
            {event.course_label}
          </h1>
          <p className="text-sm text-[#4a4a55]">
            Teams of {event.target_team_size} · {students.length} students ·
            join code <span className="font-mono font-semibold">{event.join_code}</span>
          </p>
        </div>

        {isOwner && (
          <TeacherControls
            eventId={id}
            studentCount={students.length}
            state={event.state}
            hasTeams={(teams?.length ?? 0) > 0}
          />
        )}

        {!isOwner && myMember && (
          <div className="rounded-xl border border-[#e6e1ef] bg-white p-5">
            <div className="mb-3 font-semibold text-[#32235f]">
              You&apos;ve joined this event
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/events/${id}/profile`}
                className="rounded-lg bg-[#4b2e83] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#32235f]"
              >
                Edit your profile
              </Link>
              {event.state === "peer_review" && (
                <Link
                  href={`/events/${id}/rate`}
                  className="rounded-lg border border-[#d8cfe9] px-4 py-2 text-sm font-medium text-[#4b2e83] transition hover:bg-[#efeaf7]"
                >
                  Rate teammates
                </Link>
              )}
              {(teams?.length ?? 0) > 0 && (
                <Link
                  href={`/events/${id}/reputation`}
                  className="rounded-lg border border-[#d8cfe9] px-4 py-2 text-sm font-medium text-[#4b2e83] transition hover:bg-[#efeaf7]"
                >
                  View reputation
                </Link>
              )}
            </div>
          </div>
        )}

        {isOwner && students.length > 0 && (
          <div className="rounded-xl border border-[#e6e1ef] bg-white p-5">
            <h2 className="mb-3 font-semibold text-[#32235f]">
              Roster — {students.length} students
              <span className="ml-2 text-sm font-normal text-[#4a4a55]">
                ({joinedCount} joined · {students.length - joinedCount} invited)
              </span>
            </h2>
            <div className="max-h-72 overflow-auto rounded-lg border border-[#f0ecf7]">
              <ul className="divide-y divide-[#f0ecf7] text-sm">
                {students.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-[#1b1b1f]">
                      {m.roster_name}{" "}
                      <span className="text-[#4a4a55]">· {m.roster_email}</span>
                    </span>
                    {m.user_id ? (
                      <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-xs font-medium text-[#1f7a3a]">
                        joined
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#efeaf7] px-2 py-0.5 text-xs text-[#4b2e83]">
                        invited
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {(teams?.length ?? 0) > 0 ? (
          <div>
            <h2 className="mb-3 text-lg font-bold text-[#32235f]">
              AI-formed teams
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {teams!.map((t) => {
                const r = (t.rationale ?? {}) as Rationale;
                const isMine =
                  !!myMember &&
                  (memberIdsByTeam.get(t.id) ?? []).includes(myMember.id);
                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border bg-white p-5 ${
                      isMine
                        ? "border-2 border-[#ffc83d] ring-2 ring-[#ffc83d]/40"
                        : "border-[#e6e1ef]"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-bold text-[#32235f]">
                        {t.label}
                        {isMine && (
                          <span className="ml-2 rounded-full bg-[#ffc83d] px-2 py-0.5 text-xs font-bold text-[#32235f]">
                            Your team
                          </span>
                        )}
                      </span>
                      <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-xs font-semibold text-[#7a5b00]">
                        score {t.score}
                      </span>
                    </div>
                    <ul className="mb-3 space-y-0.5 text-sm text-[#1b1b1f]">
                      {(membersByTeam.get(t.id) ?? []).map((nm, i) => (
                        <li key={i}>• {nm}</li>
                      ))}
                    </ul>
                    <div className="text-xs text-[#4a4a55]">
                      <div>Skills: {(r.skills_covered ?? []).join(", ") || "—"}</div>
                      <div>Shared time slots: {r.shared_availability ?? 0}</div>
                      <div>
                        Shared interests:{" "}
                        {(r.shared_topics ?? []).join(", ") || "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#4a4a55]">
            No teams yet.{" "}
            {isOwner
              ? "Seed some demo students, then click Form teams."
              : "Teams haven't been formed yet."}
          </p>
        )}
      </section>
    </main>
  );
}
