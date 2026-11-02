"use client";

// The 3D café (public/cafe, a self-contained WebGL2 page) shown full-screen on every device.
// The café page itself scales down to the screen and stays in landscape on phones.
// The Supabase URL and publishable key go along as query params so the café can read the admin's
// published content (panels, signs, gallery, credits) and testimonials, and accept new written ones.
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SRC = SB && KEY ? `/cafe/index.html?sb=${encodeURIComponent(SB)}&k=${encodeURIComponent(KEY)}` : "/cafe/index.html";

export default function Cafe3D() {
  return (
    <iframe
      src={SRC}
      title="Coffee & Code — first-person café"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, display: "block" }}
      allow="fullscreen"
    />
  );
}
