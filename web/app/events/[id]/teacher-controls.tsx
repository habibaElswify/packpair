"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  seedDemoStudents,
  formTeams,
  setEventState,
  simulateRatings,
} from "@/app/actions";

export function TeacherControls({
  eventId,
  studentCount,
  state,
  hasTeams,
}: {
  eventId: string;
  studentCount: number;
  state: string;
  hasTeams: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <button
          disabled={pending}
          onClick={() => run("seed", () => seedDemoStudents(eventId, 12))}
          className={btn}
        >
          {busy === "seed" ? "Seeding…" : "Seed 12 demo students"}
        </button>
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
        {hasTeams && (
          <button
            disabled={pending}
            onClick={() => run("sim", () => simulateRatings(eventId))}
            className={btn}
          >
            {busy === "sim" ? "Simulating…" : "Simulate demo ratings"}
          </button>
        )}
        {hasTeams && (
          <Link href={`/events/${eventId}/reputation`} className={btn}>
            View reputation →
          </Link>
        )}
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-[#fde7e9] px-3 py-2 text-sm text-[#b7202f]">
          {error}
        </p>
      )}
    </div>
  );
}
