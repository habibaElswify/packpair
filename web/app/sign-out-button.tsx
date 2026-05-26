"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className="rounded-lg border border-[#e6e1ef] px-4 py-2 text-sm font-medium text-[#4a4a55] transition hover:bg-[#efeaf7]"
    >
      Sign out
    </button>
  );
}
