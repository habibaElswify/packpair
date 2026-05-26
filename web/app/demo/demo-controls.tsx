"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guestRegenerateAndForm, guestSimulateRatings } from "@/app/actions";

export function DemoControls() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(label: string, fn: () => Promise<void>) {
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

  return (
    <div className="mb-6 rounded-xl border border-[#e6e1ef] bg-white p-4">
      <p className="mb-3 text-sm text-[#4a4a55]">
        This is the real app, live — try it yourself (no login):
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending}
          onClick={() => run("form", guestRegenerateAndForm)}
          className="rounded-lg bg-[#4b2e83] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#32235f] disabled:opacity-50"
        >
          {busy === "form" ? "Running the solver…" : "🎲 New class → form teams"}
        </button>
        <button
          disabled={pending}
          onClick={() => run("rate", guestSimulateRatings)}
          className="rounded-lg border border-[#d8cfe9] px-4 py-2 text-sm font-medium text-[#4b2e83] transition hover:bg-[#efeaf7] disabled:opacity-50"
        >
          {busy === "rate" ? "Simulating…" : "⭐ Run a peer-rating round"}
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
