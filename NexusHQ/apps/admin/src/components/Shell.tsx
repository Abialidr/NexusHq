"use client";

// Admin chrome: collapsible sidebar groups, breadcrumb top bar, theme toggle and the mobile slide-in nav.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";
import { ToastProvider } from "@/components/ui";
import { HOSTED } from "@/lib/hosted";
import { NAV } from "@/lib/sections";
import { publicConfig } from "@/lib/publicConfig";
import { signOut } from "@/app/actions";

export default function Shell({ email, badges, children }: { email: string; badges: Record<string, number>; children: ReactNode }) {
  const path = usePathname();
  const seg = path.split("/")[1] ?? "";
  const [navOpen, setNavOpen] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  useEffect(() => setNavOpen(false), [path]);
  useEffect(() => {
    document.body.classList.toggle("nav-open", navOpen);
  }, [navOpen]);

  const group = NAV.find((g) => "items" in g && g.items.some(([k]) => k === seg));
  const label = "items" in (group ?? {}) ? (group as { items: readonly (readonly [string, string])[] }).items.find(([k]) => k === seg)?.[1] : "Dashboard";

  const toggleTheme = () => {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("nx-admin-theme", r.dataset.theme); } catch {}
  };

  return (
    <ToastProvider>
      <div className="app">
        <aside className="side" aria-label="Admin navigation">
          <div className="brand">
            <div className="brand-mark">N</div>
            <div><b>NexusHQ</b><small>Admin console</small></div>
          </div>
          <nav>
            {NAV.map((g, gi) => {
              if ("single" in g) {
                return (
                  <div className="nav-group" key={gi}>
                    <Link className="nav-head nav-link nav-single" href="/" aria-current={seg === "" ? "page" : undefined}><Icon name={g.icon} />{g.label}</Link>
                  </div>
                );
              }
              const isOpen = open[gi] ?? (g.open || g.items.some(([k]) => k === seg));
              return (
                <div className="nav-group" data-open={isOpen} key={gi}>
                  <button className="nav-head" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [gi]: !isOpen }))}>
                    <Icon name={g.icon} />{g.group}<Icon name="chev" className="i chev" />
                  </button>
                  <div className="nav-items"><div>
                    {g.items.filter(([k]) => !(HOSTED && k === "agents")).map(([k, l]) => (
                      <Link key={k} className="nav-link" href={`/${k}`} aria-current={seg === k ? "page" : undefined} tabIndex={isOpen ? 0 : -1}>
                        {l}{badges[k] ? <span className="dot">{badges[k]}</span> : null}
                      </Link>
                    ))}
                  </div></div>
                </div>
              );
            })}
          </nav>
          <div className="side-foot">
            <div className="avatar">{email.slice(0, 2).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}><b style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{email}</b><span className="role">Admin</span></div>
            <form action={signOut} style={{ marginLeft: "auto" }}>
              <button className="icon-btn" title="Sign out" aria-label="Sign out"><Icon name="out" /></button>
            </form>
          </div>
        </aside>

        <div className="main">
          <header className="top">
            <button className="icon-btn menu-btn" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Icon name="menu" /></button>
            <div className="crumbs">{group && "group" in group ? <>{group.group} / <b>{label}</b></> : <b>Dashboard</b>}</div>
            <span style={{ marginLeft: "auto" }} />
            {publicConfig().portfolioUrl && (
              <a className="btn sm ghost hide-sm" href={publicConfig().portfolioUrl} target="_blank" rel="noreferrer">View site ↗</a>
            )}
            <button className="icon-btn" aria-label="Toggle theme" onClick={toggleTheme}><Icon name="moon" /></button>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
      <div className="scrim" onClick={() => setNavOpen(false)} />
    </ToastProvider>
  );
}
