import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google hands the login back here. We exchange the code for a session and
// enforce the @uw.edu restriction server-side (the hd hint alone isn't security).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email ?? "";
      if (!email.toLowerCase().endsWith("@uw.edu")) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=not_uw`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
