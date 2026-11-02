"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/experience", label: "Experience" },
  { href: "/projects", label: "Projects" },
  { href: "/skills", label: "Skills" },
  { href: "/open-source", label: "Open source" },
  { href: "/articles", label: "Articles" },
  { href: "/contact", label: "Contact" },
] as const;

export default function SiteHeader({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // close the drawer after navigating
  useEffect(() => setOpen(false), [pathname]);

  // while the drawer is open: lock page scroll, close on Escape, move focus in and back out
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    const btn = menuBtn.current;
    return () => { document.body.style.overflow = prev; removeEventListener("keydown", onKey); btn?.focus(); };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="site-head">
        <div className="wrap">
          <Link className="brand" href="/">
            <b>coffee &amp; code</b>
            <span>{name} · {role}</span>
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>{n.label}</Link>
            ))}
          </nav>
          <div className="head-actions">
            <Link className="btn btn-ghost" href="/3d" style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }}>3D café</Link>
            <ThemeToggle />
            <button ref={menuBtn} className="icon-btn menu-btn" aria-label="Open menu" aria-controls="site-drawer" aria-expanded={open} onClick={() => setOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* mobile drawer: outside the header, whose backdrop-filter would trap a fixed panel inside it */}
      <div className={`drawer-backdrop${open ? " open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="site-drawer" className={`drawer${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu" inert={!open}>
        <div className="drawer-head">
          <span className="brand"><b>coffee &amp; code</b></span>
          <button ref={closeBtn} className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <nav aria-label="Main">
          {NAV.map((n, i) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} style={{ "--i": i } as React.CSSProperties} onClick={() => setOpen(false)}>{n.label}</Link>
          ))}
        </nav>
        <div className="drawer-foot">
          <Link className="btn btn-primary" href="/contact" onClick={() => setOpen(false)}>Get in touch <span className="arr">→</span></Link>
          <span className="small muted" style={{ textAlign: "center" }}>{name} · {role}</span>
        </div>
      </aside>
    </>
  );
}
