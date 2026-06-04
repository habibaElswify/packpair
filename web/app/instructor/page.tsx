import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InstructorVerify } from "./verify";

export default async function InstructorPage() {
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
  const verified = !!(profile?.is_instructor || profile?.is_app_admin);

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <Link href="/" className="text-sm opacity-90 hover:opacity-100">
          ← Back to events
        </Link>
      </header>

      <section className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-bold text-[#32235f]">Instructor verification</h1>
        <p className="mb-6 text-sm text-[#4a4a55]">
          Only verified instructors can create team-formation events. We confirm
          it with Canvas — you must teach or TA a course. Students don&apos;t
          need this; they just join with a code.
        </p>

        {verified && (
          <div className="mb-6 rounded-xl border border-[#cdeed7] bg-[#e6f4ea] p-5">
            <div className="font-semibold text-[#1f7a3a]">
              You&apos;re verified as an instructor ✓
            </div>
            <Link
              href="/events/new"
              className="mt-3 inline-block rounded-lg bg-[#4b2e83] px-5 py-2.5 font-semibold text-white transition hover:bg-[#32235f]"
            >
              + Create an event
            </Link>
          </div>
        )}

        <div className="rounded-xl border border-[#e6e1ef] bg-white p-5">
          <h2 className="mb-1 font-semibold text-[#32235f]">
            {verified ? "Re-test Canvas connection" : "Verify with Canvas"}
          </h2>
          <p className="mb-4 text-sm text-[#4a4a55]">
            {verified
              ? "You're already flagged as an instructor, but you can re-run the Canvas API check anytime to confirm the pipeline reports your Teacher/TA enrollments correctly."
              : "Paste a Canvas access token to confirm your Teacher/TA role."}
          </p>
          <InstructorVerify />
        </div>
      </section>
    </main>
  );
}
