import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f7f5fb]">
      <header className="flex items-center justify-between border-b-4 border-[#ffc83d] bg-[#4b2e83] px-7 py-3 text-white">
        <div className="flex items-center gap-3 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#ffc83d] to-[#b7a57a] text-sm font-black text-[#32235f]">
            PP
          </div>
          PackPair
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="opacity-90">{user.email}</span>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-[#32235f]">
          You&apos;re signed in 🎉
        </h1>
        <p className="mt-2 text-[#4a4a55]">
          Signed in as <strong>{user.email}</strong> with your real UW Google
          account. The profile, matches, ratings, and reputation screens land
          next.
        </p>
      </section>
    </main>
  );
}
