import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherControls } from "./teacher-controls";

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
    .select("id, roster_name, role")
    .eq("event_id", id);
  const students = (members ?? []).filter((m) => m.role === "student");
  const nameById = new Map((members ?? []).map((m) => [m.id, m.roster_name]));

  const { data: teams } = await supabase
    .from("teams")
    .select("id, label, score, rationale")
    .eq("event_id", id)
    .order("label");
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("team_id, member_id");
  const membersByTeam = new Map<string, string[]>();
  for (const tm of teamMembers ?? []) {
    const list = membersByTeam.get(tm.team_id) ?? [];
    list.push(nameById.get(tm.member_id) ?? "—");
    membersByTeam.set(tm.team_id, list);
  }

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
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
          <TeacherControls eventId={id} studentCount={students.length} />
        )}

        {(teams?.length ?? 0) > 0 ? (
          <div>
            <h2 className="mb-3 text-lg font-bold text-[#32235f]">
              AI-formed teams
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {teams!.map((t) => {
                const r = (t.rationale ?? {}) as Rationale;
                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-[#e6e1ef] bg-white p-5"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-bold text-[#32235f]">{t.label}</span>
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
