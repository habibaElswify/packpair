"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  seedDemoStudents,
  formTeams,
  setEventState,
  simulateRatings,
  deleteEvent,
} from "@/app/actions";

export function TeacherControls({
  eventId,
  studentCount,
  state,
  hasTeams,
  isAppAdmin,
}: {
  eventId: string;
  studentCount: number;
  state: string;
  hasTeams: boolean;
  isAppAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    if (
      !confirm(
        "Delete this event? Its roster, teams, and ratings are removed permanently. This can't be undone.",
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteEvent(eventId);
    } catch {
      setDeleting(false);
    }
  }

  function run(label: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusy(label);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(null);
      }
    });
  }

  const btn =
    "rounded-lg border border-[#d8cfe9] px-4 py-2 text-sm font-medium text-[#4b2e83] transition hover:bg-[#efeaf7] disabled:opacity-50";
  const primary =
    "rounded-lg bg-[#4b2e83] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#32235f] disabled:opacity-50";

  return (
    <div className="rounded-xl border border-[#e6e1ef] bg-white p-5">
      <h2 className="mb-3 font-semibold text-[#32235f]">Instructor controls</h2>
      <div className="flex flex-wrap gap-3">
        {isAppAdmin && (
          <button
            disabled={pending}
            onClick={() => run("seed", () => seedDemoStudents(eventId, 12))}
            className={btn}
            title="Admin-only: seed synthetic students for testing"
          >
            {busy === "seed" ? "Seeding…" : "Seed 12 demo students"}
          </button>
        )}
        <Link href={`/events/${eventId}/canvas`} className={btn}>
          Import from Canvas
        </Link>
        <button
          disabled={pending || studentCount < 2}
          onClick={() => run("match", () => formTeams(eventId))}
          className={primary}
        >
          {busy === "match" ? "Forming teams…" : `Form teams (${studentCount})`}
        </button>

        {hasTeams && state !== "peer_review" && (
          <button
            disabled={pending}
            onClick={() => run("open", () => setEventState(eventId, "peer_review"))}
            className={btn}
          >
            {busy === "open" ? "Opening…" : "Open peer review"}
          </button>
        )}
        {hasTeams && isAppAdmin && (
          <button
            disabled={pending}
            onClick={() => run("sim", () => simulateRatings(eventId))}
            className={btn}
            title="Admin-only: replaces real peer ratings with synthetic ones"
          >
            {busy === "sim" ? "Simulating…" : "Simulate demo ratings"}
          </button>
        )}
        {hasTeams && (
          <Link href={`/events/${eventId}/reputation`} className={btn}>
            View reputation →
          </Link>
        )}
        <button
          onClick={onDelete}
          disabled={deleting || pending}
          className="rounded-lg border border-[#f3c9ce] px-4 py-2 text-sm font-medium text-[#b7202f] transition hover:bg-[#fde7e9] disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete event"}
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-[#fde7e9] px-3 py-2 text-sm text-[#b7202f]">
          {error}
        </p>
      )}
    </div>
  );
}
