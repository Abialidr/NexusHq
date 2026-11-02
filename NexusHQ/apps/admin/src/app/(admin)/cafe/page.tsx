import CafeEditor from "@/components/CafeEditor";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "3D café" };

export default async function CafePage() {
  await requireAdmin();
  const supabase = await createClient();
  const [s, p, c] = await Promise.all([
    supabase.from("site_settings").select("*").single(),
    supabase.from("cafe_panels").select("*").order("sort_order"),
    supabase.from("model_credits").select("*").order("sort_order"),
  ]);
  if (s.error) throw new Error(s.error.message);
  return <CafeEditor settings={s.data} panels={p.data ?? []} credits={c.data ?? []} />;
}
