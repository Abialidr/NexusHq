import Link from "next/link";
import type { Link as SocialLink } from "@/types/portfolio";

export default async function SiteFooter({ name, socials }: { name: string; socials: SocialLink[] }) {
  // cached so the copyright year is computed at build/revalidate time, not per request
  "use cache";
  return (
    <footer className="site-foot">
      <div className="wrap">
        <span>© {new Date().getFullYear()} {name} · Made with coffee &amp; code</span>
        <div className="row">
          {socials.map((s) => <a key={s.label} className="link" href={s.url}>{s.label}</a>)}
          <Link className="link" href="/contact">Email</Link>
        </div>
      </div>
    </footer>
  );
}
