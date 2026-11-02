import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { connection } from "next/server";
import ConfigBridge from "@/components/ConfigBridge";
import { getConfig, toPublic } from "@/lib/config";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });
const sans = Instrument_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "600"] });

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
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><ConfigBridge config={config && toPublic(config)}>{children}</ConfigBridge></body>
    </html>
  );
}
