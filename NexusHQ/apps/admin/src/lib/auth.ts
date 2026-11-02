import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
}

// The admin role lives in app_metadata (server-set, not user-editable) and is the same claim RLS checks via
// public.is_admin(). Call this at the top of every admin page and every Server Action.
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");
  const role = (claims.app_metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") redirect("/login?error=not-admin");
  return { id: claims.sub, email: String(claims.email ?? "") };
}
