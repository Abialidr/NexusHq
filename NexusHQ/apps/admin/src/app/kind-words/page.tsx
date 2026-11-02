import CollectPage from "@/components/CollectPage";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kind words" };

// Open collection link: anyone can leave a testimonial while the admin has it switched on.
export default async function OpenCollectPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profile").select("name").single(),
    supabase.from("site_settings").select("open_collection_enabled").single(),
  ]);
  const name = profile?.name ?? "";
  return (
    <CollectPage ownerName={name} ownerInitials={name.slice(0, 2).toUpperCase() || "★"} token={null} clientName="" projectName={null}
      allowed={["video", "audio", "text"]}
      closed={settings?.open_collection_enabled ? undefined : "Submissions through this link are paused right now. If you were sent a personal link, please use that one."} />
  );
}
