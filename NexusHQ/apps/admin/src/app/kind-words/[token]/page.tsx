import CollectPage from "@/components/CollectPage";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kind words" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Personal request link. open_testimonial_request() marks it opened and returns only the pre-fill data;
// unknown, expired or already-used tokens return nothing.
export default async function RequestCollectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: profile }, req] = await Promise.all([
    supabase.from("profile").select("name").single(),
    UUID.test(token) ? supabase.rpc("open_testimonial_request", { p_token: token }) : Promise.resolve({ data: null }),
  ]);
  const name = profile?.name ?? "";
  const r = req.data?.[0];
  return (
    <CollectPage ownerName={name} ownerInitials={name.slice(0, 2).toUpperCase() || "★"} token={r ? token : null}
      clientName={r?.client_name ?? ""} projectName={r?.project_name ?? null} allowed={r?.allowed_kinds?.length ? r.allowed_kinds : ["text"]}
      closed={r ? undefined : "This link has expired or was already used. Thank you if you already sent your words!"} />
  );
}
