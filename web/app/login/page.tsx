"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ERRORS: Record<string, string> = {
  not_uw: "PackPair is UW-only — please sign in with your @uw.edu Google account.",
  auth: "Sign-in didn't complete. Please try again.",
};

function LoginCard() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const errorKey = params.get("error");

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        // hd nudges Google to the UW workspace; real enforcement is server-side.
        queryParams: { hd: "uw.edu", prompt: "select_account" },
      },
    });
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-[#e6e1ef] bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#ffc83d] to-[#b7a57a] font-black text-[#32235f]">
          PP
        </div>
        <span className="text-xl font-bold text-[#32235f]">PackPair</span>
      </div>
      <h1 className="mb-1 text-2xl font-bold text-[#1b1b1f]">
        Find your project team
      </h1>
      <p className="mb-6 text-sm text-[#4a4a55]">
        AI-powered team formation for UW class projects.
      </p>

      {errorKey && (
        <div className="mb-4 rounded-lg border border-[#fde7e9] bg-[#fde7e9] px-3 py-2 text-sm text-[#b7202f]">
          {ERRORS[errorKey] ?? "Something went wrong."}
        </div>
      )}

      <button
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#4b2e83] px-4 py-3 font-semibold text-white transition hover:bg-[#32235f] disabled:opacity-60"
      >
        {busy ? "Redirecting…" : "Sign in with UW Google"}
      </button>
      <p className="mt-4 text-center text-xs text-[#4a4a55]">
        Restricted to @uw.edu accounts.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f5fb] px-6">
      <Suspense>
        <LoginCard />
      </Suspense>
    </main>
  );
}
