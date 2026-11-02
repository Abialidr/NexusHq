import Link from "next/link";
import type { Link as SocialLink } from "@/types/portfolio";

export default async function SiteFooter({ name, socials }: { name: string; socials: SocialLink[] }) {
  // cached so the copyright year is computed at build/revalidate time, not per request
  "use cache";
  return (
    <footer className="site-foot">
      <div className="wrap">
        <span>© {new Date().getFullYear()} {name} · Made with coffee &amp; code</span>
        <nav className="row footer-nav" aria-label="Footer navigation">
          <Link className="link" href="/">Home</Link>
          <Link className="link" href="/about">About</Link>
          <Link className="link" href="/experience">Experience</Link>
          <Link className="link" href="/projects">Projects</Link>
          <Link className="link" href="/skills">Skills</Link>
          <Link className="link" href="/open-source">Open source</Link>
          <Link className="link" href="/articles">Articles</Link>
          <Link className="link" href="/contact">Contact</Link>
          <Link className="link" href="/3d">Visit the 3D café</Link>
        </nav>
        <div className="row">
          {socials.map((s) => <a key={s.label} className="link" href={s.url}>{s.label}</a>)}
          <Link className="link" href="/contact">Email</Link>
        </div>
      </div>
    </footer>
  );
}
