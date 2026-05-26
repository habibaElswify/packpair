import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinEvent } from "@/app/actions";

export default async function JoinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <Link href="/" className="text-sm opacity-90 hover:opacity-100">
          ← Back to events
        </Link>
      </header>

      <section className="mx-auto max-w-md px-6 py-12">
        <h1 className="mb-1 text-2xl font-bold text-[#32235f]">Join an event</h1>
        <p className="mb-6 text-sm text-[#4a4a55]">
          Enter the code your instructor shared.
        </p>
        <form action={joinEvent} className="flex gap-3">
          <input
            name="code"
            required
            autoComplete="off"
            placeholder="e.g. SDR9XA"
            className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2 font-mono uppercase tracking-widest"
          />
          <button
            type="submit"
            className="rounded-lg bg-[#4b2e83] px-5 py-2 font-semibold text-white transition hover:bg-[#32235f]"
          >
            Join
          </button>
        </form>
      </section>
    </main>
  );
}
