"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeRosterMember } from "@/app/actions";

export function RemoveRosterButton({
  eventId,
  memberId,
  rosterName,
}: {
  eventId: string;
  memberId: string;
  rosterName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onRemove() {
    if (
      !confirm(
        `Remove ${rosterName} from this event's roster? Their profile, team membership, and ratings for this event will be deleted.`,
      )
    )
      return;
    start(async () => {
      try {
        await removeRosterMember(eventId, memberId);
        router.refresh();
      } catch {
        /* surface generic; the roster will simply not update */
      }
    });
  }
  return (
    <button
      onClick={onRemove}
      disabled={pending}
      title="Remove from roster"
      className="ml-2 rounded-md border border-[#f3c9ce] px-2 py-0.5 text-[11px] font-medium text-[#b7202f] transition hover:bg-[#fde7e9] disabled:opacity-50"
    >
      {pending ? "…" : "remove"}
    </button>
  );
}
