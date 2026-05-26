import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SECRET key. Bypasses RLS for trusted
// server-side writes (match results, demo seeding). NEVER import this into a
// client component — the secret key must stay on the server.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}
