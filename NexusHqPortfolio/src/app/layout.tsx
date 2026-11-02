import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

// Self-hosted Latin subsets (variable weight ranges) from Google Fonts: next/font/google's build-time
// download broke under Turbopack ("next/font/google queries have exactly one entry"), and local files
// also mean no network fetch at build time.
const display = localFont({ src: "./fonts/BricolageGrotesque-latin.woff2", variable: "--font-display", weight: "500 800", display: "swap" });
const sans = localFont({ src: "./fonts/InstrumentSans-latin.woff2", variable: "--font-sans", weight: "400 600", display: "swap" });
const mono = localFont({ src: "./fonts/JetBrainsMono-500-latin.woff2", variable: "--font-mono", weight: "500", display: "swap" });

export const metadata: Metadata = {
  title: { default: "coffee & code — portfolio", template: "%s · coffee & code" },
  description: "Full-stack, AI and cloud engineer. Products, AI agents and the cloud they run on — as a fast 2D site or a 3D coffee shop.",
};

// Runs before first paint: applies the saved light/dark choice (no flash of the wrong theme) and
// turns on the motion layer unless the visitor prefers reduced motion, so entrance animations
// start with the first frame instead of after hydration.
const themeScript = `try{var d=document.documentElement,t=localStorage.getItem('theme');if(t==='light'||t==='dark')d.dataset.theme=t;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('motion')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        {/* beforeInteractive: Next inlines it into the server HTML, so it still runs before first paint */}
        <Script id="theme" strategy="beforeInteractive">{themeScript}</Script>
        {children}
      </body>
    </html>
  );
}
