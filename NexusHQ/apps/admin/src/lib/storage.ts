import { publicConfig } from "@/lib/publicConfig";

// Public URL of a file in the public "portfolio" bucket (no request needed; the bucket is public-read).
export function publicUrl(path: string | null | undefined) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${publicConfig().supabaseUrl}/storage/v1/object/public/portfolio/${path.split("/").map(encodeURIComponent).join("/")}`;
}
