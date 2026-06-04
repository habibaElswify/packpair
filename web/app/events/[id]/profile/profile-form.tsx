"use client";

// Client form for the student profile. Splits the chip groups so we can show
// a live "n of MIN selected" counter under each label and disable the submit
// button until every minimum is met. The server action still re-validates so
// crafted requests can't slip past (see saveProfile in app/actions.ts).

import { useState, useTransition } from "react";
import { saveProfile } from "@/app/actions";

const MIN_SKILLS = 2;
const MIN_AVAIL = 2;
const MIN_TOPICS = 1;

type Slot = { id: number; label: string };
type CommStyle = "sync" | "async" | "mixed";

export function ProfileForm({
  eventId,
  skills,
  topics,
  slots,
  initial,
}: {
  eventId: string;
  skills: readonly string[];
  topics: readonly string[];
  slots: readonly Slot[];
  initial: {
    skills: string[];
    topics: string[];
    availability: number[];
    comm_style: CommStyle;
  };
}) {
  const [sel, setSel] = useState({
    skills: new Set(initial.skills),
    topics: new Set(initial.topics),
    availability: new Set(initial.availability),
    comm_style: initial.comm_style,
  });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle<T extends string | number>(
    field: "skills" | "topics" | "availability",
    value: T,
  ) {
    setSel((s) => {
      const next = new Set(s[field] as Set<T>);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...s, [field]: next };
    });
  }

  const okSkills = sel.skills.size >= MIN_SKILLS;
  const okTopics = sel.topics.size >= MIN_TOPICS;
  const okAvail = sel.availability.size >= MIN_AVAIL;
  const allOk = okSkills && okTopics && okAvail;

  async function onSubmit() {
    if (!allOk || pending) return;
    setError(null);
    const fd = new FormData();
    sel.skills.forEach((v) => fd.append("skills", v));
    sel.topics.forEach((v) => fd.append("topics", v));
    sel.availability.forEach((v) => fd.append("availability", String(v)));
    fd.append("comm_style", sel.comm_style);
    start(async () => {
      try {
        await saveProfile(eventId, fd);
      } catch (e) {
        // saveProfile throws NEXT_REDIRECT on success — let it propagate.
        const msg = e instanceof Error ? e.message : String(e);
        if (/NEXT_REDIRECT/.test(msg)) throw e;
        setError(msg);
      }
    });
  }

  return (
    <div className="space-y-7">
      <Group
        label="Skills you bring"
        count={sel.skills.size}
        min={MIN_SKILLS}
        ok={okSkills}
      >
        {skills.map((sk) => (
          <Chip
            key={sk}
            checked={sel.skills.has(sk)}
            onClick={() => toggle("skills", sk)}
          >
            {sk}
          </Chip>
        ))}
      </Group>

      <Group
        label="Topics you're interested in"
        count={sel.topics.size}
        min={MIN_TOPICS}
        ok={okTopics}
      >
        {topics.map((t) => (
          <Chip
            key={t}
            checked={sel.topics.has(t)}
            onClick={() => toggle("topics", t)}
          >
            {t}
          </Chip>
        ))}
      </Group>

      <Group
        label="When you're free to meet"
        count={sel.availability.size}
        min={MIN_AVAIL}
        ok={okAvail}
      >
        {slots.map((slot) => (
          <Chip
            key={slot.id}
            checked={sel.availability.has(slot.id)}
            onClick={() => toggle("availability", slot.id)}
          >
            {slot.label}
          </Chip>
        ))}
      </Group>

      <div>
        <span className="mb-2 block text-sm font-semibold text-[#1b1b1f]">
          Communication style
        </span>
        <div className="flex flex-wrap gap-2">
          {(["sync", "async", "mixed"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSel((s) => ({ ...s, comm_style: c }))}
              className={`rounded-full border px-4 py-1.5 text-sm capitalize transition ${
                sel.comm_style === c
                  ? "border-[#4b2e83] bg-[#4b2e83] text-white"
                  : "border-[#d8cfe9] text-[#1b1b1f] hover:border-[#4b2e83]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-[#fde7e9] px-3 py-2 text-sm text-[#b7202f]">
          {error}
        </p>
      )}

      <button
        onClick={onSubmit}
        disabled={!allOk || pending}
        className="rounded-lg bg-[#4b2e83] px-5 py-2.5 font-semibold text-white transition hover:bg-[#32235f] disabled:cursor-not-allowed disabled:bg-[#b7a7d4]"
      >
        {pending
          ? "Saving…"
          : allOk
            ? "Save profile"
            : "Pick the required minimum first"}
      </button>
    </div>
  );
}

function Group({
  label,
  count,
  min,
  ok,
  children,
}: {
  label: string;
  count: number;
  min: number;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[#1b1b1f]">{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            ok
              ? "bg-[#e6f4ea] text-[#1f7a3a]"
              : "bg-[#fff3d6] text-[#7a5b00]"
          }`}
        >
          {ok ? "✓" : ""} {count} of {min}
          {ok ? " ✓" : " required"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        checked
          ? "border-[#4b2e83] bg-[#4b2e83] text-white"
          : "border-[#d8cfe9] text-[#1b1b1f] hover:border-[#4b2e83]"
      }`}
    >
      {children}
    </button>
  );
}
