"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { listTaughtCourses, importCanvasRoster } from "@/app/actions";
import type { TaughtCourse } from "@/lib/canvas";

export function CanvasConnect({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [base, setBase] = useState("https://canvas.uw.edu");
  const [token, setToken] = useState("");
  const [courses, setCourses] = useState<TaughtCourse[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const cs = await listTaughtCourses(base, token);
      setCourses(cs);
      if (cs.length === 0)
        setMsg("Canvas doesn't list you as a teacher/TA of any course with this token.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach Canvas");
    } finally {
      setBusy(false);
    }
  }

  async function importRoster(courseId: number) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const n = await importCanvasRoster(eventId, courseId, base, token);
      setMsg(`Imported ${n} students from Canvas.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[#1b1b1f]">
          Canvas base URL
        </span>
        <input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          className="w-full rounded-lg border border-[#d8cfe9] px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[#1b1b1f]">
          Canvas access token
        </span>
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
        onClick={connect}
        disabled={busy || !token}
        className="rounded-lg bg-[#4b2e83] px-5 py-2.5 font-semibold text-white transition hover:bg-[#32235f] disabled:opacity-50"
      >
        {busy ? "Connecting…" : "Connect & list my courses"}
      </button>

      {error && (
        <p className="rounded-lg bg-[#fde7e9] px-3 py-2 text-sm text-[#b7202f]">
          {error}
        </p>
      )}
      {msg && (
        <p className="rounded-lg bg-[#e6f4ea] px-3 py-2 text-sm text-[#1f7a3a]">
          {msg}
        </p>
      )}

      {courses && courses.length > 0 && (
        <div className="rounded-xl border border-[#e6e1ef] bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-[#32235f]">
            Courses you teach
          </div>
          <ul className="space-y-2">
            {courses.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-[#e6e1ef] px-3 py-2"
              >
                <span className="text-sm">{c.name}</span>
                <button
                  onClick={() => importRoster(c.id)}
                  disabled={busy}
                  className="rounded-lg border border-[#d8cfe9] px-3 py-1.5 text-sm font-medium text-[#4b2e83] transition hover:bg-[#efeaf7] disabled:opacity-50"
                >
                  Import roster
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
