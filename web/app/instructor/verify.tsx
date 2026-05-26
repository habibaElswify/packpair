"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyInstructor } from "@/app/actions";

export function InstructorVerify() {
  const router = useRouter();
  const [base, setBase] = useState("https://canvas.uw.edu");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const count = await verifyInstructor(base, token);
      if (count > 0) {
        setMsg(`Verified — Canvas lists you as teacher/TA of ${count} course(s). Redirecting…`);
        router.push("/");
        router.refresh();
      } else {
        setMsg(
          "Canvas doesn't list you as a teacher or TA of any course with this token, so event creation stays locked. Students just join with a code.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach Canvas");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[#1b1b1f]">Canvas base URL</span>
        <input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[#1b1b1f]">Canvas access token</span>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste your Canvas API token"
          className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2"
        />
        <span className="mt-1 block text-xs text-[#4a4a55]">
          Canvas → Account → Settings → Approved Integrations → + New Access Token.
        </span>
      </label>
      <button
        onClick={verify}
        disabled={busy || !token}
        className="rounded-lg bg-[#4b2e83] px-5 py-2.5 font-semibold text-white transition hover:bg-[#32235f] disabled:opacity-50"
      >
        {busy ? "Verifying with Canvas…" : "Verify instructor status"}
      </button>
      {error && (
        <p className="rounded-lg bg-[#fde7e9] px-3 py-2 text-sm text-[#b7202f]">{error}</p>
      )}
      {msg && (
        <p className="rounded-lg bg-[#e6f4ea] px-3 py-2 text-sm text-[#1f7a3a]">{msg}</p>
      )}
    </div>
  );
}
