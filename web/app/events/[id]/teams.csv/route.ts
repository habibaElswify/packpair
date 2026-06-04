// Instructor-only CSV download of the formed teams for this event. One row
// per (team, student), plus aggregate score/rationale on the first row of
// each team. Useful for end-of-quarter records and for re-weighting the
// CP-SAT objective next quarter against team-success outcomes.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Rationale = {
  skills_covered?: string[];
  shared_availability?: number;
  shared_topics?: string[];
};

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Owner-only — never expose team membership lists to non-instructors.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("owner_id, course_label, join_code")
    .eq("id", id)
    .maybeSingle();
  if (!event) return new NextResponse("Not found", { status: 404 });
  if (event.owner_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: teams } = await admin
    .from("teams")
    .select("id, label, score, rationale")
    .eq("event_id", id)
    .order("label");
  const { data: tms } = await admin
    .from("team_members")
    .select("team_id, member_id");
  const { data: members } = await admin
    .from("event_members")
    .select("id, roster_name, roster_email, user_id")
    .eq("event_id", id);
  const memberById = new Map((members ?? []).map((m) => [m.id, m]));

  const memberIdsByTeam = new Map<string, string[]>();
  for (const tm of tms ?? []) {
    const l = memberIdsByTeam.get(tm.team_id) ?? [];
    l.push(tm.member_id);
    memberIdsByTeam.set(tm.team_id, l);
  }

  const rows: string[] = [
    [
      "team_label",
      "team_score",
      "skills_covered",
      "shared_availability_slots",
      "shared_topics",
      "student_name",
      "student_email",
      "joined",
    ]
      .map(csvEscape)
      .join(","),
  ];

  for (const t of teams ?? []) {
    const r = (t.rationale ?? {}) as Rationale;
    const ids = memberIdsByTeam.get(t.id) ?? [];
    for (const mid of ids) {
      const m = memberById.get(mid);
      if (!m) continue;
      rows.push(
        [
          t.label,
          t.score,
          (r.skills_covered ?? []).join("; "),
          r.shared_availability ?? 0,
          (r.shared_topics ?? []).join("; "),
          m.roster_name,
          m.roster_email,
          m.user_id ? "yes" : "no",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
  }

  const filename = `packpair-${(event.course_label ?? "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-teams.csv`;
  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
