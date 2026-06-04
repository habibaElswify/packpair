import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SKILLS, TOPICS, SLOTS, type CommStyle } from "@/lib/types";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({
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
  const { data: member } = await admin
    .from("event_members")
    .select("id")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) redirect("/join");

  const { data: existing } = await admin
    .from("student_profiles")
    .select("skills, topics, availability, comm_style")
    .eq("member_id", member.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <Link href={`/events/${id}`} className="text-sm opacity-90 hover:opacity-100">
          ← Back to event
        </Link>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-[#32235f]">Your profile</h1>
        <p className="mb-2 text-sm text-[#4a4a55]">
          For <strong>{event.course_label}</strong>. This is what the AI uses to
          place you on a balanced team.
        </p>
        <p className="mb-6 rounded-lg border border-[#fde7d6] bg-[#fff8ef] px-3 py-2 text-xs text-[#7a5b00]">
          <strong>Required minimums:</strong> at least 2 skills · 2 time slots ·
          1 topic. The Save button stays disabled until each one is met.
        </p>

        <ProfileForm
          eventId={id}
          skills={SKILLS}
          topics={TOPICS}
          slots={SLOTS}
          initial={{
            skills: (existing?.skills ?? []) as string[],
            topics: (existing?.topics ?? []) as string[],
            availability: (existing?.availability ?? []) as number[],
            comm_style: (existing?.comm_style ?? "mixed") as CommStyle,
          }}
        />
      </section>
    </main>
  );
}
