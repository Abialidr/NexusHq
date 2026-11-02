import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireConfig } from "@/lib/config";
import type { Database } from "@/lib/database.types";

// Server client for Server Components and Server Actions. User-scoped (publishable key + session cookies),
// so every query runs under RLS as the signed-in admin; no service-role key exists in this app.
export async function createClient() {
  const cookieStore = await cookies();
  const config = requireConfig();
  return createServerClient<Database>(
    config.supabaseUrl,
    config.publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only; the proxy refreshes the session.
          }
        },
      },
    },
  );
}
