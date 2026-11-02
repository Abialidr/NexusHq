import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Recordings from the public testimonial form go straight to Supabase Storage, not through Server Actions,
  // so the default body limit is fine; images are plain <div> backgrounds, no next/image remote config needed.
  poweredByHeader: false,
  // packages/shared ships plain .ts (no build step); Next compiles it like app code.
  transpilePackages: ["@nexushq/shared"],
};

export default nextConfig;
