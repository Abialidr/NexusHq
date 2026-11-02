import TestimonialsBoard, { type TestimonialView } from "@/components/TestimonialsBoard";
import { requireAdmin } from "@/lib/auth";
import { publicUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [t, r, p, s] = await Promise.all([
    supabase.from("testimonials").select("*").order("sort_order").order("created_at", { ascending: false }),
    supabase.from("testimonial_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name, slug").order("sort_order"),
    supabase.from("site_settings").select("open_collection_enabled").single(),
  ]);
  if (t.error) throw new Error(t.error.message);

  // Pending uploads sit in the private bucket: sign short-lived URLs so only the admin can play them.
  const privatePaths = (t.data ?? []).flatMap((x) => [x.media_path, x.avatar_path]).filter((x): x is string => !!x?.startsWith("incoming/"));
  const signed = new Map<string, string>();
  if (privatePaths.length) {
    const { data } = await supabase.storage.from("testimonial-uploads").createSignedUrls(privatePaths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && signed.set(d.path, d.signedUrl));
  }
  const url = (path: string | null) => (!path ? "" : path.startsWith("incoming/") ? signed.get(path) ?? "" : publicUrl(path));

  const items: TestimonialView[] = (t.data ?? []).map((x) => ({ ...x, mediaUrl: url(x.media_path), avatarUrl: url(x.avatar_path) }));
  return <TestimonialsBoard items={items} requests={r.data ?? []} projects={p.data ?? []} openEnabled={s.data?.open_collection_enabled ?? true} />;
}
