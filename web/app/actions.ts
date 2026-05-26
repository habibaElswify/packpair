"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SOLVER = process.env.NEXT_PUBLIC_SOLVER_API_URL ?? "http://localhost:8000";

function joinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

async function requireOwner(eventId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (!data || data.owner_id !== userId) {
    throw new Error("Not authorized for this event");
  }
  return data;
}

export async function createEvent(formData: FormData) {
  const user = await requireUser();
  const admin = createAdminClient();

  const courseLabel = String(formData.get("course_label") ?? "").trim();
  const targetSize = Number(formData.get("target_team_size") ?? 3);
  const remainderPolicy = String(formData.get("remainder_policy") ?? "strict_best_fit");
  const stragglerPolicy = String(formData.get("straggler_policy") ?? "neutral_default");
  const minSize = formData.get("min_size") ? Number(formData.get("min_size")) : null;
  const maxSize = formData.get("max_size") ? Number(formData.get("max_size")) : null;

  if (!courseLabel) throw new Error("Course label is required");

  const { data: event, error } = await admin
    .from("events")
    .insert({
      owner_id: user.id,
      course_label: courseLabel,
      target_team_size: targetSize,
      remainder_policy: remainderPolicy,
      straggler_policy: stragglerPolicy,
      min_size: minSize,
      max_size: maxSize,
      state: "enrolling",
      join_code: joinCode(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // The owner is recorded as the teacher member of their own event.
  await admin.from("event_members").insert({
    event_id: event.id,
    user_id: user.id,
    roster_name: user.email ?? "Instructor",
    roster_email: user.email ?? `${user.id}@unknown`,
    role: "teacher",
    source: "join_code",
  });

  redirect(`/events/${event.id}`);
}

export async function seedDemoStudents(eventId: string, n = 12) {
  const user = await requireUser();
  await requireOwner(eventId, user.id);
  const admin = createAdminClient();

  const res = await fetch(`${SOLVER}/demo/students?n=${n}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not reach the solver service");
  const { students } = (await res.json()) as {
    students: {
      name: string;
      skills: string[];
      availability: number[];
      comm_style: string;
      topics: string[];
    }[];
  };

  for (const s of students) {
    const { data: member, error } = await admin
      .from("event_members")
      .insert({
        event_id: eventId,
        roster_name: s.name,
        roster_email: `${s.name.toLowerCase()}@demo.packpair`,
        role: "student",
        source: "seed",
      })
      .select("id")
      .single();
    if (error) continue; // skip duplicates on re-seed
    await admin.from("student_profiles").insert({
      event_id: eventId,
      member_id: member.id,
      skills: s.skills,
      availability: s.availability,
      comm_style: s.comm_style,
      topics: s.topics,
      complete: true,
    });
  }
  revalidatePath(`/events/${eventId}`);
}

export async function formTeams(eventId: string) {
  const user = await requireUser();
  const event = await requireOwner(eventId, user.id);
  const admin = createAdminClient();

  // Student roster + their profiles.
  const { data: members } = await admin
    .from("event_members")
    .select("id, role")
    .eq("event_id", eventId)
    .eq("role", "student");
  const { data: profiles } = await admin
    .from("student_profiles")
    .select("member_id, skills, availability, comm_style, topics")
    .eq("event_id", eventId);

  const profileByMember = new Map(
    (profiles ?? []).map((p) => [p.member_id, p]),
  );

  // Build the solver payload; apply the straggler policy for missing profiles.
  const students: {
    name: string;
    skills: string[];
    availability: number[];
    comm_style: string;
    topics: string[];
  }[] = [];
  for (const m of members ?? []) {
    const p = profileByMember.get(m.id);
    if (p) {
      students.push({
        name: m.id, // use member id so we can map results back
        skills: p.skills ?? [],
        availability: p.availability ?? [],
        comm_style: p.comm_style ?? "mixed",
        topics: p.topics ?? [],
      });
    } else if (event.straggler_policy === "neutral_default") {
      students.push({
        name: m.id,
        skills: [],
        availability: Array.from({ length: 14 }, (_, i) => i),
        comm_style: "mixed",
        topics: [],
      });
    }
    // "exclude"/"nudge" → leave out of this match
  }

  if (students.length < 2) throw new Error("Need at least 2 students with profiles");

  const res = await fetch(`${SOLVER}/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      students,
      target_size: event.target_team_size,
      remainder_policy: event.remainder_policy,
      min_size: event.min_size,
      max_size: event.max_size,
    }),
  });
  if (!res.ok) throw new Error("Solver failed to form teams");
  const result = (await res.json()) as {
    teams: {
      members: string[];
      size: number;
      score: number;
      rationale: Record<string, unknown>;
    }[];
  };

  // Replace any prior teams, then persist the new ones.
  await admin.from("teams").delete().eq("event_id", eventId);
  let n = 1;
  for (const t of result.teams) {
    const { data: team } = await admin
      .from("teams")
      .insert({
        event_id: eventId,
        label: `Team ${n++}`,
        score: t.score,
        rationale: t.rationale,
      })
      .select("id")
      .single();
    if (!team) continue;
    await admin.from("team_members").insert(
      t.members.map((memberId) => ({ team_id: team.id, member_id: memberId })),
    );
  }

  await admin.from("events").update({ state: "matched" }).eq("id", eventId);
  revalidatePath(`/events/${eventId}`);
}
