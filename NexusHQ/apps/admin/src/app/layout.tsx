import type { Metadata } from "next";
import { connection } from "next/server";
import ConfigBridge from "@/components/ConfigBridge";
import { getConfig, toPublic } from "@/lib/config";
import "./globals.css";

// Plain Google Fonts stylesheet instead of next/font: next/font/google fails to build on Vercel when the build runs
// from the monorepo root (Turbopack can't resolve its internal font loader). globals.css maps --font-* to these.
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800" +
  "&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap";

export const metadata: Metadata = {
  title: { default: "NexusHQ Admin", template: "%s · NexusHQ Admin" },
  robots: { index: false, follow: false },
};

// Applies the saved light/dark choice before paint so there is no theme flash.
const themeScript = `try{var t=localStorage.getItem('nx-admin-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

// The Supabase URL/key are read from nexushq.config.json on each request (not baked in at build time) and handed to
// client code through ConfigBridge, so the setup wizard can change them without a rebuild. connection() keeps
// this from running at build time, where it would freeze whatever config the build machine had.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const config = getConfig();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body><ConfigBridge config={config && toPublic(config)}>{children}</ConfigBridge></body>
    </html>
  );
}
