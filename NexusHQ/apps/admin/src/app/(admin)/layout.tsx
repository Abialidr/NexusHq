import Shell from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Every page in this group is admin-only: requireAdmin() runs on the server before anything renders.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const [t, m] = await Promise.all([
    supabase.from("testimonials").select("id", { count: "exact", head: true }).eq("state", "pending"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return (
    <Shell email={user.email} badges={{ testimonials: t.count ?? 0, messages: m.count ?? 0 }}>
      {children}
    </Shell>
  );
}
