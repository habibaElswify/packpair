"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedDemoStudents, formTeams } from "@/app/actions";

export function TeacherControls({
  eventId,
  studentCount,
}: {
  eventId: string;
  studentCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setBusyLabel(label);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusyLabel(null);
      }
    });
  }

  return (
    <div className="rounded-xl border border-[#e6e1ef] bg-white p-5">
      <h2 className="mb-3 font-semibold text-[#32235f]">Instructor controls</h2>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending}
          onClick={() => run("seed", () => seedDemoStudents(eventId, 12))}
          className="rounded-lg border border-[#d8cfe9] px-4 py-2 text-sm font-medium text-[#4b2e83] transition hover:bg-[#efeaf7] disabled:opacity-50"
        >
          {busyLabel === "seed" ? "Seeding…" : "Seed 12 demo students"}
        </button>
        <button
          disabled={pending || studentCount < 2}
          onClick={() => run("match", () => formTeams(eventId))}
          className="rounded-lg bg-[#4b2e83] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#32235f] disabled:opacity-50"
        >
          {busyLabel === "match"
            ? "Forming teams…"
            : `Form teams (${studentCount} students)`}
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
