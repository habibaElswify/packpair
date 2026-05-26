import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CanvasConnect } from "./canvas-connect";
import { importRosterText } from "@/app/actions";

export default async function CanvasPage({
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
    .select("id, course_label, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();
  if (event.owner_id !== user.id) redirect(`/events/${id}`);

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <Link href={`/events/${id}`} className="text-sm opacity-90 hover:opacity-100">
          ← Back to event
        </Link>
      </header>

      <section className="mx-auto max-w-xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-bold text-[#32235f]">
          Import your class roster
        </h1>
        <p className="mb-6 text-sm text-[#4a4a55]">
          Import the students for <strong>{event.course_label}</strong>. Once a
          roster is imported, <strong>only those emails can join</strong> with
          the code — everyone else is turned away.
        </p>

        <div className="mb-8 rounded-xl border border-[#e6e1ef] bg-white p-5">
          <h2 className="mb-1 font-semibold text-[#32235f]">
            Paste the roster <span className="text-xs font-normal text-[#1f7a3a]">(recommended · verified)</span>
          </h2>
          <p className="mb-3 text-sm text-[#4a4a55]">
            Easiest: in Canvas open <em>Grades → Export → Export Entire
            Gradebook</em>, then paste the whole CSV here — we read the{" "}
            <code>Student</code> and <code>SIS Login ID</code> columns and
            ignore the grades. (Or paste a simple list: one UW email or NetID
            per line.)
          </p>
          <form action={importRosterText.bind(null, id)} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1b1b1f]">
                Upload the gradebook CSV
              </label>
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-[#4a4a55] file:mr-3 file:rounded-lg file:border-0 file:bg-[#efeaf7] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#4b2e83]"
              />
            </div>
            <div className="text-center text-xs text-[#4a4a55]">— or paste it —</div>
            <textarea
              name="roster"
              rows={7}
              placeholder={"Paste the gradebook CSV, or:\nmpatel@uw.edu\njchen\nSara Ahmed, sahmed@uw.edu"}
              className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2 font-mono text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#4b2e83] px-5 py-2.5 font-semibold text-white transition hover:bg-[#32235f]"
            >
              Import roster
            </button>
          </form>
          <p className="mt-3 text-xs text-[#4a4a55]">
            Where to get it: Canvas → <em>Grades → Export</em> (the CSV includes
            each student&apos;s NetID), or your class email list.
          </p>
        </div>

        <details>
          <summary className="cursor-pointer text-sm font-medium text-[#4b2e83]">
            Or pull it from Canvas automatically (needs a teacher token · experimental)
          </summary>
          <div className="mt-4">
            <CanvasConnect eventId={id} />
          </div>
        </details>
      </section>
    </main>
  );
}
