import { Suspense } from "react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import MotionLayer from "@/components/motion/MotionLayer";
import { getPortfolioContent } from "@/lib/content/get-portfolio-content";

// Shell for every 2D page (/, /about, /projects, …). /3d sits outside this group and stays full-screen.
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { profile } = await getPortfolioContent();
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Suspense fallback={null}><SiteHeader name={profile.name} role={profile.role} /></Suspense>
      <main id="main">{children}</main>
      <SiteFooter name={profile.name} socials={profile.socials} />
      <Suspense fallback={null}><MotionLayer /></Suspense>
    </>
  );
}
