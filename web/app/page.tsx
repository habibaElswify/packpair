import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import type { EventState } from "@/lib/types";
import Logo from "../components/Logo";

const STATE_LABEL: Record<EventState, string> = {
  draft: "Draft",
  enrolling: "Enrolling",
  matched: "Teams formed",
  in_progress: "In progress",
  peer_review: "Peer review open",
  closed: "Closed",
};

export default async function Home() {
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
  const canCreate = !!(profile?.is_instructor || profile?.is_app_admin);

  const { data: events } = await supabase
    .from("events")
    .select("id, course_label, state, target_team_size, join_code, owner_id, created_at")
    .eq("is_demo", false) // the public demo sandbox never shows on dashboards
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="flex items-center justify-between border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <div className="flex items-center gap-3 font-bold">
        <Logo />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="opacity-90">{user.email}</span>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#32235f]">Your events</h1>
          <div className="flex gap-2">
            <Link
              href="/join"
              className="rounded-lg border border-[#4b2e83] px-4 py-2 text-sm font-semibold text-[#4b2e83] transition hover:bg-[#efeaf7]"
            >
              Join with code
            </Link>
            {canCreate && (
              <Link
                href="/events/new"
                className="rounded-lg bg-[#4b2e83] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#32235f]"
              >
                + Create event
              </Link>
            )}
          </div>
        </div>

        {!canCreate && (
          <div className="mb-6 rounded-xl border border-[#e6e1ef] bg-white p-4 text-sm text-[#4a4a55]">
            Students: join your class with the code from your instructor.{" "}
            <Link href="/instructor" className="font-medium text-[#4b2e83] underline">
              Are you an instructor? Verify with Canvas to create events →
            </Link>
          </div>
        )}

        {!events || events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d8cfe9] bg-white p-10 text-center text-[#4a4a55]">
            <div className="mb-3">No events yet.</div>
            {canCreate ? (
              <Link
                href="/events/new"
                className="inline-block rounded-lg bg-[#4b2e83] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#32235f]"
              >
                + Create your first event
              </Link>
            ) : (
              <Link
                href="/join"
                className="inline-block rounded-lg border border-[#4b2e83] px-5 py-2 text-sm font-semibold text-[#4b2e83] transition hover:bg-[#efeaf7]"
              >
                Join your class with a code →
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="flex items-center justify-between rounded-xl border border-[#e6e1ef] bg-white p-5 transition hover:border-[#b7a57a] hover:shadow-sm"
                >
                  <div>
                    <div className="font-semibold text-[#1b1b1f]">
                      {e.course_label}
                    </div>
                    <div className="text-sm text-[#4a4a55]">
                      Teams of {e.target_team_size}
                      {e.owner_id === user.id ? " · you're the instructor" : ""}
                    </div>
                  </div>
                  <span className="rounded-full bg-[#efeaf7] px-3 py-1 text-xs font-medium text-[#4b2e83]">
                    {STATE_LABEL[e.state as EventState] ?? e.state}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
