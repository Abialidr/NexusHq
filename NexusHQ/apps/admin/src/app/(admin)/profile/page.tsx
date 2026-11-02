import ProfileForm from "@/components/ProfileForm";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile & About" };

export default async function ProfilePage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profile").select("*").single();
  if (error) throw new Error(error.message);
  return <ProfileForm initial={data as never} />;
}
