"use client";

import { useState } from "react";
import { joinEvent } from "@/app/actions";

export function JoinForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await joinEvent(fd); // success → server action redirects
    } catch (err) {
      // Only real errors land here; Next handles the redirect on success.
      const msg = err instanceof Error ? err.message : "Could not join";
      // Filter out Next's internal redirect signal just in case.
      if (!/NEXT_REDIRECT/.test(msg)) setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex gap-3">
        <input
          name="code"
          required
          autoComplete="off"
          placeholder="e.g. SDR9XA"
          className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2 font-mono uppercase tracking-widest"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#4b2e83] px-5 py-2 font-semibold text-white transition hover:bg-[#32235f] disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-[#fde7e9] px-3 py-2 text-sm text-[#b7202f]">
          {error}
        </p>
      )}
    </form>
  );
}
