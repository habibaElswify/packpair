import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveProfile } from "@/app/actions";
import { SKILLS, TOPICS, SLOTS, type CommStyle } from "@/lib/types";

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

  const has = (arr: (string | number)[] | null | undefined, v: string | number) =>
    (arr ?? []).map(String).includes(String(v));

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <Link href={`/events/${id}`} className="text-sm opacity-90 hover:opacity-100">
          ← Back to event
        </Link>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-[#32235f]">Your profile</h1>
        <p className="mb-6 text-sm text-[#4a4a55]">
          For <strong>{event.course_label}</strong>. This is what the AI uses to
          place you on a balanced team.
        </p>

        <form action={saveProfile.bind(null, id)} className="space-y-7">
          <Group label="Skills you bring">
            {SKILLS.map((sk) => (
              <Chip key={sk} name="skills" value={sk} checked={has(existing?.skills, sk)}>
                {sk}
              </Chip>
            ))}
          </Group>

          <Group label="Topics you're interested in">
            {TOPICS.map((t) => (
              <Chip key={t} name="topics" value={t} checked={has(existing?.topics, t)}>
                {t}
              </Chip>
            ))}
          </Group>

          <Group label="When you're free to meet">
            {SLOTS.map((slot) => (
              <Chip
                key={slot.id}
                name="availability"
                value={String(slot.id)}
                checked={has(existing?.availability, slot.id)}
              >
                {slot.label}
              </Chip>
            ))}
          </Group>

          <div>
            <span className="mb-2 block text-sm font-semibold text-[#1b1b1f]">
              Communication style
            </span>
            <div className="flex flex-wrap gap-2">
              {(["sync", "async", "mixed"] as CommStyle[]).map((c) => (
                <label key={c} className="cursor-pointer">
                  <input
                    type="radio"
                    name="comm_style"
                    value={c}
                    defaultChecked={(existing?.comm_style ?? "mixed") === c}
                    className="peer sr-only"
                  />
                  <span className="inline-block rounded-full border border-[#d8cfe9] px-4 py-1.5 text-sm capitalize transition peer-checked:border-[#4b2e83] peer-checked:bg-[#4b2e83] peer-checked:text-white">
                    {c}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-[#4b2e83] px-5 py-2.5 font-semibold text-white transition hover:bg-[#32235f]"
          >
            Save profile
          </button>
        </form>
      </section>
    </main>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-2 block text-sm font-semibold text-[#1b1b1f]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  name,
  value,
  checked,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked}
        className="peer sr-only"
      />
      <span className="inline-block rounded-full border border-[#d8cfe9] px-3 py-1.5 text-sm transition peer-checked:border-[#4b2e83] peer-checked:bg-[#4b2e83] peer-checked:text-white">
        {children}
      </span>
    </label>
  );
}
