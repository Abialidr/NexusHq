import Inbox from "@/components/Inbox";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contact messages" };

export default async function MessagesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return <Inbox messages={data ?? []} />;
}
