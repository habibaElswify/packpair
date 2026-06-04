"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTaughtCourses,
  getCourseRoster,
  DEFAULT_CANVAS_BASE,
  type TaughtCourse,
} from "@/lib/canvas";

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

// Used to gate the synthetic-data shortcuts ("Seed demo students",
// "Simulate demo ratings") so only the platform owner sees them. Real
// instructors using PackPair for their own class should not see those
// shortcuts on their event pages.
async function requireAppAdmin(userId: string) {
  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("is_app_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!prof?.is_app_admin) {
    throw new Error("Admin-only action");
  }
}

export async function createEvent(formData: FormData) {
  const user = await requireUser();
  const admin = createAdminClient();

  // Only verified instructors (or app admins) may create events.
  const { data: prof } = await admin
    .from("profiles")
    .select("is_instructor, is_app_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.is_instructor && !prof?.is_app_admin) {
    throw new Error(
      "Only verified instructors can create events. Verify your instructor status first.",
    );
  }

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
  await requireAppAdmin(user.id);
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

export async function joinEvent(formData: FormData) {
  const user = await requireUser();
  const admin = createAdminClient();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) throw new Error("Enter a join code");

  const { data: event } = await admin
    .from("events")
    .select("id")
    .eq("join_code", code)
    .maybeSingle();
  if (!event) throw new Error("No event found for that code");

  const email = (user.email ?? "").toLowerCase();

  // Already joined?
  const { data: existing } = await admin
    .from("event_members")
    .select("id")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect(`/events/${event.id}/profile`);

  // If the instructor imported a roster, ONLY emails on that roster may join.
  const { data: roster } = await admin
    .from("event_members")
    .select("id, roster_email, user_id")
    .eq("event_id", event.id)
    .in("source", ["csv", "canvas"]);

  if (roster && roster.length > 0) {
    const seat = roster.find((r) => (r.roster_email ?? "").toLowerCase() === email);
    if (!seat) {
      throw new Error(
        "Your UW email isn't on this class's roster. Ask your instructor to add you.",
      );
    }
    if (!seat.user_id) {
      await admin.from("event_members").update({ user_id: user.id }).eq("id", seat.id);
    }
  } else {
    // No roster imported → open join by code.
    await admin.from("event_members").insert({
      event_id: event.id,
      user_id: user.id,
      roster_name: user.email ?? "Student",
      roster_email: user.email ?? `${user.id}@unknown`,
      role: "student",
      source: "join_code",
    });
  }
  redirect(`/events/${event.id}/profile`);
}

// Parse one CSV line, honoring double-quoted fields (e.g. "Patel, Maya").
// Split a line on the given delimiter, honoring double-quoted fields. Handles
// both comma CSV (downloaded export) and tab-separated (columns copied from a
// spreadsheet, where names like "Patel, Maya" are NOT quoted).
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toEmail(loginId: string): string {
  const v = loginId.trim();
  return v.includes("@") ? v.toLowerCase() : `${v.toLowerCase()}@uw.edu`;
}

// Verified roster import. Accepts EITHER a Canvas Gradebook CSV export
// (header with "SIS Login ID") — names + NetIDs are pulled out, grade columns
// ignored — OR a simple list ("email", "Name, email", "netid", "Name, netid").
export async function importRosterText(eventId: string, formData: FormData) {
  const user = await requireUser();
  await requireOwner(eventId, user.id);
  const admin = createAdminClient();

  let raw = String(formData.get("roster") ?? "");
  const file = formData.get("file");
  if (file && typeof file !== "string" && file.size > 0) {
    raw = await file.text(); // uploaded CSV takes precedence over pasted text
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const entries: { name: string; email: string }[] = [];

  // Columns copied from a spreadsheet are tab-separated; a downloaded CSV is commas.
  const delim = (lines[0] ?? "").includes("\t") ? "\t" : ",";
  const header = lines[0] ? splitLine(lines[0], delim) : [];
  const sisIdx = header.findIndex((h) => /^sis login id$/i.test(h.trim()));

  if (sisIdx >= 0) {
    // Canvas Gradebook export — use the SIS Login ID column (the NetID).
    const studentIdx = header.findIndex((h) => /^student$/i.test(h.trim()));
    for (const line of lines.slice(1)) {
      const cols = splitLine(line, delim);
      const sis = (cols[sisIdx] ?? "").trim();
      const student = (studentIdx >= 0 ? cols[studentIdx] ?? "" : "").trim();
      if (!sis) continue; // skips "Points Possible" and blank rows
      if (/test student/i.test(student) || /^points possible$/i.test(student)) continue;
      let name = student;
      if (student.includes(",")) {
        const [last, first] = student.split(",").map((s) => s.trim());
        name = `${first} ${last}`.trim();
      }
      const email = toEmail(sis);
      entries.push({ name: name || email.split("@")[0], email });
    }
  } else {
    // Simple list.
    for (const line of lines.map((l) => l.trim())) {
      const m = line.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (m) {
        const email = m[0].toLowerCase();
        const name = line.replace(m[0], "").replace(/[,\t]+/g, " ").trim() || email.split("@")[0];
        entries.push({ name, email });
      } else {
        const parts = line.split(/[,\t]+/).map((s) => s.trim()).filter(Boolean);
        const last = (parts[parts.length - 1] ?? "").split(/\s+/).pop() ?? "";
        if (!/^[a-zA-Z0-9._-]+$/.test(last)) continue;
        entries.push({ name: parts.length > 1 ? parts.slice(0, -1).join(" ") : last, email: toEmail(last) });
      }
    }
  }

  for (const e of entries) {
    await admin.from("event_members").insert({
      event_id: eventId,
      roster_name: e.name,
      roster_email: e.email,
      role: "student",
      source: "csv",
    });
  }
  redirect(`/events/${eventId}`);
}

export async function saveProfile(eventId: string, formData: FormData) {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("event_members")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) throw new Error("You haven't joined this event");

  const skills = formData.getAll("skills").map(String);
  const topics = formData.getAll("topics").map(String);
  const availability = formData.getAll("availability").map((v) => Number(v));
  const commStyle = String(formData.get("comm_style") ?? "mixed");

  await admin.from("student_profiles").upsert(
    {
      event_id: eventId,
      member_id: member.id,
      skills,
      topics,
      availability,
      comm_style: commStyle,
      complete: skills.length > 0 && availability.length > 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,member_id" },
  );
  redirect(`/events/${eventId}`);
}

const DIMENSIONS = ["participation", "communication", "technical"] as const;

export async function setEventState(eventId: string, state: string) {
  const user = await requireUser();
  await requireOwner(eventId, user.id);
  const admin = createAdminClient();
  await admin.from("events").update({ state }).eq("id", eventId);
  revalidatePath(`/events/${eventId}`);
}

export async function deleteEvent(eventId: string) {
  const user = await requireUser();
  await requireOwner(eventId, user.id);
  const admin = createAdminClient();
  // Cascades to members, profiles, teams, ratings (FK on delete cascade).
  await admin.from("events").delete().eq("id", eventId);
  redirect("/");
}

export async function saveRatings(eventId: string, formData: FormData) {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: me } = await admin
    .from("event_members")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me) throw new Error("You're not in this event");

  const rows: {
    event_id: string;
    rater_member_id: string;
    subject_member_id: string;
    dimension: string;
    stars: number;
  }[] = [];
  for (const [key, value] of formData.entries()) {
    // keys look like rating-<subjectMemberId>-<dimension>
    const m = /^rating-(.+)-(participation|communication|technical)$/.exec(key);
    if (!m) continue;
    const stars = Number(value);
    if (!stars) continue;
    rows.push({
      event_id: eventId,
      rater_member_id: me.id,
      subject_member_id: m[1],
      dimension: m[2],
      stars,
    });
  }
  if (rows.length) {
    await admin
      .from("ratings")
      .upsert(rows, {
        onConflict: "event_id,rater_member_id,subject_member_id,dimension",
      });
  }
  await rebuildReputationForEvent(admin, eventId);
  redirect(`/events/${eventId}/reputation`);
}

// Realistic single-project peer ratings: only a student's ACTUAL teammates rate
// them, so teams of 3 produce exactly 2 ratings per dimension. Reputation then
// honestly shows "new" until ratings accumulate across multiple projects (k=5).
// Persist Bayesian Beta(α,β) posteriors per (user_id, dimension) to the
// reputation table — deterministic recompute from every rating the user has
// received across ALL their events, so reputation accumulates over a quarter.
// Synthetic seed students (no user_id) are skipped naturally.
async function rebuildReputationForEvent(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
) {
  const { data: members } = await admin
    .from("event_members")
    .select("id, user_id")
    .eq("event_id", eventId);
  const affected = new Set<string>();
  for (const m of members ?? []) if (m.user_id) affected.add(m.user_id);
  if (affected.size === 0) return;

  for (const uid of affected) {
    const { data: theirSeats } = await admin
      .from("event_members")
      .select("id")
      .eq("user_id", uid);
    const seatIds = (theirSeats ?? []).map((m) => m.id);
    if (seatIds.length === 0) continue;
    const { data: allRatings } = await admin
      .from("ratings")
      .select("dimension, stars")
      .in("subject_member_id", seatIds);

    const stats = new Map<string, { alpha: number; beta: number }>();
    for (const r of allRatings ?? []) {
      const s = (r.stars - 1) / 4;
      const cur = stats.get(r.dimension) ?? { alpha: 1.0, beta: 1.0 };
      cur.alpha += s;
      cur.beta += 1 - s;
      stats.set(r.dimension, cur);
    }

    const rows = Array.from(stats.entries()).map(([dim, st]) => ({
      user_id: uid,
      dimension: dim,
      alpha: st.alpha,
      beta: st.beta,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      await admin
        .from("reputation")
        .upsert(rows, { onConflict: "user_id,dimension" });
    }
  }
}

async function regenerateTeammateRatings(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
) {
  const { data: teams } = await admin.from("teams").select("id").eq("event_id", eventId);
  const teamIds = new Set((teams ?? []).map((t) => t.id));
  const { data: tms } = await admin.from("team_members").select("team_id, member_id");
  const byTeam = new Map<string, string[]>();
  for (const tm of tms ?? []) {
    if (!teamIds.has(tm.team_id)) continue;
    const l = byTeam.get(tm.team_id) ?? [];
    l.push(tm.member_id);
    byTeam.set(tm.team_id, l);
  }

  await admin.from("ratings").delete().eq("event_id", eventId);
  const quality = new Map<string, number>();
  const rows: {
    event_id: string;
    rater_member_id: string;
    subject_member_id: string;
    dimension: string;
    stars: number;
  }[] = [];
  for (const ids of byTeam.values()) {
    for (const id of ids)
      if (!quality.has(id)) quality.set(id, 0.4 + Math.random() * 0.55);
    for (const subject of ids) {
      for (const rater of ids) {
        if (rater === subject) continue; // only teammates, not self
        for (const dim of DIMENSIONS) {
          const noisy = Math.max(
            0,
            Math.min(1, quality.get(subject)! + (Math.random() - 0.5) * 0.3),
          );
          rows.push({
            event_id: eventId,
            rater_member_id: rater,
            subject_member_id: subject,
            dimension: dim,
            stars: Math.round(1 + 4 * noisy),
          });
        }
      }
    }
  }
  if (rows.length)
    await admin.from("ratings").upsert(rows, {
      onConflict: "event_id,rater_member_id,subject_member_id,dimension",
    });
  await rebuildReputationForEvent(admin, eventId);
}

export async function simulateRatings(eventId: string) {
  const user = await requireUser();
  await requireOwner(eventId, user.id);
  await requireAppAdmin(user.id);
  await regenerateTeammateRatings(createAdminClient(), eventId);
  revalidatePath(`/events/${eventId}/reputation`);
}

// Instructor gate: verify the signed-in user teaches/TAs a Canvas course. If
// Canvas confirms a Teacher/TA enrollment, flag them as an instructor (so they
// can create events). Returns the number of taught courses (0 = not verified).
export async function verifyInstructor(
  baseUrl: string,
  token: string,
): Promise<number> {
  const user = await requireUser();
  const admin = createAdminClient();
  const base = baseUrl?.trim() || DEFAULT_CANVAS_BASE;
  await admin.from("canvas_links").upsert(
    { user_id: user.id, canvas_base_url: base, access_token: token },
    { onConflict: "user_id" },
  );
  const courses = await getTaughtCourses(base, token);
  if (courses.length > 0) {
    await admin.from("profiles").update({ is_instructor: true }).eq("id", user.id);
  }
  return courses.length;
}

// Canvas: verify the user is a teacher (returns their taught courses) and save
// their token. An empty list means Canvas doesn't see them as a teacher.
// Manually add a single student to the roster (e.g. a late add or a classmate
// who isn't in the gradebook yet). Same gate semantics as a CSV import.
export async function addRosterMember(eventId: string, formData: FormData) {
  const user = await requireUser();
  await requireOwner(eventId, user.id);
  const admin = createAdminClient();

  const name = String(formData.get("name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  if (!emailRaw) throw new Error("Email or NetID is required");

  // Accept full email or just a NetID (we append @uw.edu).
  const email = emailRaw.includes("@")
    ? emailRaw.toLowerCase()
    : `${emailRaw.toLowerCase()}@uw.edu`;
  const displayName = name || email.split("@")[0];

  const { error } = await admin.from("event_members").insert({
    event_id: eventId,
    roster_name: displayName,
    roster_email: email,
    role: "student",
    source: "csv",
  });
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      throw new Error(`${email} is already on this roster.`);
    }
    throw new Error(error.message);
  }
  revalidatePath(`/events/${eventId}`);
}

// Remove a student from the roster. Cascades to their profile, team
// membership, and ratings (the FKs use ON DELETE CASCADE).
export async function removeRosterMember(eventId: string, memberId: string) {
  const user = await requireUser();
  await requireOwner(eventId, user.id);
  const admin = createAdminClient();
  // Defense-in-depth: only delete members of this event, and never the
  // teacher's own roster row.
  await admin
    .from("event_members")
    .delete()
    .eq("id", memberId)
    .eq("event_id", eventId)
    .neq("role", "teacher");
  revalidatePath(`/events/${eventId}`);
}

export async function listTaughtCourses(
  baseUrl: string,
  token: string,
): Promise<TaughtCourse[]> {
  const user = await requireUser();
  const admin = createAdminClient();
  const base = baseUrl?.trim() || DEFAULT_CANVAS_BASE;
  await admin.from("canvas_links").upsert(
    { user_id: user.id, canvas_base_url: base, access_token: token },
    { onConflict: "user_id" },
  );
  return getTaughtCourses(base, token);
}

// Canvas: pull a course's student roster into the event (the "magic" import).
export async function importCanvasRoster(
  eventId: string,
  courseId: number,
  baseUrl: string,
  token: string,
): Promise<number> {
  const user = await requireUser();
  await requireOwner(eventId, user.id);
  const admin = createAdminClient();
  const base = baseUrl?.trim() || DEFAULT_CANVAS_BASE;

  const roster = await getCourseRoster(base, token, courseId);
  let added = 0;
  for (const r of roster) {
    const { error } = await admin.from("event_members").insert({
      event_id: eventId,
      roster_name: r.name,
      roster_email: r.email,
      role: "student",
      source: "canvas",
    });
    if (!error) added++; // skip duplicates (unique on event_id, roster_email)
  }
  await admin
    .from("events")
    .update({ canvas_course_id: String(courseId) })
    .eq("id", eventId);
  revalidatePath(`/events/${eventId}`);
  return added;
}

// ── Public demo sandbox (NO login) — operates only on the is_demo event ──

async function getDemoEvent() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("id, is_demo, target_team_size, remainder_policy, min_size, max_size")
    .eq("is_demo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.is_demo) return { admin, ev: data };

  // Lazily (re)create the public sandbox so /demo keeps working without a
  // persistent demo event sitting around on dashboards.
  const { data: owner } = await admin
    .from("profiles")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!owner) throw new Error("No profile available to own the demo sandbox");
  const code = "DEMO" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const { data: created, error } = await admin
    .from("events")
    .insert({
      owner_id: owner.id,
      course_label: "PackPair — Public Demo",
      target_team_size: 3,
      remainder_policy: "strict_best_fit",
      straggler_policy: "neutral_default",
      state: "matched",
      is_demo: true,
      join_code: code,
    })
    .select("id, is_demo, target_team_size, remainder_policy, min_size, max_size")
    .single();
  if (error || !created) throw new Error("Could not create demo sandbox");
  return { admin, ev: created };
}

// Generate a fresh random class and run the real CP-SAT solver on it.
export async function guestRegenerateAndForm() {
  const { admin, ev } = await getDemoEvent();
  const eventId = ev.id;
  await admin.from("ratings").delete().eq("event_id", eventId);
  await admin.from("teams").delete().eq("event_id", eventId);
  await admin.from("student_profiles").delete().eq("event_id", eventId);
  await admin.from("event_members").delete().eq("event_id", eventId).eq("role", "student");

  const seed = Math.floor(Math.random() * 100000);
  const dres = await fetch(`${SOLVER}/demo/students?n=12&seed=${seed}`, { cache: "no-store" });
  if (!dres.ok) throw new Error("Could not reach the solver");
  const { students } = (await dres.json()) as {
    students: { name: string; skills: string[]; availability: number[]; comm_style: string; topics: string[] }[];
  };

  const payload: { name: string; skills: string[]; availability: number[]; comm_style: string; topics: string[] }[] = [];
  for (const s of students) {
    const { data: m } = await admin
      .from("event_members")
      .insert({ event_id: eventId, roster_name: s.name, roster_email: `${s.name.toLowerCase()}@demo.packpair`, role: "student", source: "seed" })
      .select("id")
      .single();
    if (!m) continue;
    await admin.from("student_profiles").insert({
      event_id: eventId, member_id: m.id, skills: s.skills, availability: s.availability, comm_style: s.comm_style, topics: s.topics, complete: true,
    });
    payload.push({ name: m.id, skills: s.skills, availability: s.availability, comm_style: s.comm_style, topics: s.topics });
  }

  const mres = await fetch(`${SOLVER}/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ students: payload, target_size: ev.target_team_size, remainder_policy: ev.remainder_policy, min_size: ev.min_size, max_size: ev.max_size }),
  });
  if (!mres.ok) throw new Error("Solver failed");
  const result = (await mres.json()) as { teams: { members: string[]; score: number; rationale: Record<string, unknown> }[] };

  let n = 1;
  for (const t of result.teams) {
    const { data: team } = await admin.from("teams").insert({ event_id: eventId, label: `Team ${n++}`, score: t.score, rationale: t.rationale }).select("id").single();
    if (!team) continue;
    await admin.from("team_members").insert(t.members.map((mid) => ({ team_id: team.id, member_id: mid })));
  }
  await admin.from("events").update({ state: "matched" }).eq("id", eventId);
  revalidatePath("/demo");
}

// Run a realistic teammate-only peer-rating round on the demo class.
export async function guestSimulateRatings() {
  const { admin, ev } = await getDemoEvent();
  await regenerateTeammateRatings(admin, ev.id);
  revalidatePath("/demo");
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

  if (students.length < 2) {
    throw new Error(
      "Need at least 2 students on the roster (with profiles, or under the neutral-default straggler policy) to form teams.",
    );
  }

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
