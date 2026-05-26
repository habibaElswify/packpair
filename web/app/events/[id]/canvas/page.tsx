import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CanvasConnect } from "./canvas-connect";

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
          Import roster from Canvas
        </h1>
        <p className="mb-6 text-sm text-[#4a4a55]">
          Connect your Canvas account to pull the real class roster for{" "}
          <strong>{event.course_label}</strong>. We verify you&apos;re the
          teacher, then import the students by email — they just sign in and
          fill their profile.
        </p>
        <CanvasConnect eventId={id} />
      </section>
    </main>
  );
}
