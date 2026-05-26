import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/app/actions";
import {
  REMAINDER_POLICY_LABELS,
  STRAGGLER_POLICY_LABELS,
} from "@/lib/types";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_instructor, is_app_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_instructor && !profile?.is_app_admin) redirect("/instructor");

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <Link href="/" className="text-sm opacity-90 hover:opacity-100">
          ← Back to events
        </Link>
      </header>

      <section className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-bold text-[#32235f]">
          Create a team-formation event
        </h1>
        <p className="mb-6 text-sm text-[#4a4a55]">
          You&apos;re the instructor for this event. Students join, fill a
          profile, and the AI forms balanced teams.
        </p>

        <form action={createEvent} className="space-y-5">
          <Field label="Course / project name">
            <input
              name="course_label"
              required
              placeholder="CSS 382 — Final Project"
              className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2"
            />
          </Field>

          <Field label="Target team size">
            <input
              name="target_team_size"
              type="number"
              min={2}
              max={8}
              defaultValue={3}
              className="w-32 rounded-lg border border-[#d8cfe9] px-3 py-2"
            />
          </Field>

          <Field label="If the class doesn't divide evenly…">
            <select
              name="remainder_policy"
              defaultValue="strict_best_fit"
              className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2"
            >
              {Object.entries(REMAINDER_POLICY_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="For students who never fill a profile…">
            <select
              name="straggler_policy"
              defaultValue="neutral_default"
              className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2"
            >
              {Object.entries(STRAGGLER_POLICY_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Min size (flexible only)">
              <input
                name="min_size"
                type="number"
                min={1}
                placeholder="2"
                className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2"
              />
            </Field>
            <Field label="Max size (flexible only)">
              <input
                name="max_size"
                type="number"
                min={1}
                placeholder="4"
                className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2"
              />
            </Field>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-[#4b2e83] px-5 py-2.5 font-semibold text-white transition hover:bg-[#32235f]"
          >
            Create event
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#1b1b1f]">
        {label}
      </span>
      {children}
    </label>
  );
}
