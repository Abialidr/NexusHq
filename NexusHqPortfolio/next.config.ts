import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // dev only: let phones on the home network load the dev server's scripts (http://192.168.x.x:3000);
  // without this Next blocks /_next/* for them, the page never hydrates and buttons (e.g. the menu) do nothing
  allowedDevOrigins: ["192.168.*.*"],
  // the static 2D design mockups live in public/design; serve their board at /design
  async rewrites() {
    return [{ source: "/design", destination: "/design/index.html" }];
  },
  // the 2D site now lives at the root; keep old /2d links working
  async redirects() {
    // bare /2d needs its own rule: the wildcard rule would produce an empty Location header
    return [
      { source: "/2d", destination: "/", permanent: true },
      { source: "/2d/:path+", destination: "/:path+", permanent: true },
    ];
  },
};

export default nextConfig;
