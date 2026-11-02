import Link from "next/link";
import Icon from "@/components/Icon";
import { requireAdmin } from "@/lib/auth";
import { LIST_SECTIONS, type ListTable } from "@/lib/sections";
import { createClient } from "@/lib/supabase/server";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function Dashboard() {
  await requireAdmin();
  const supabase = await createClient();

  const keys = ["experience", "education", "projects", "skills", "opensource", "articles", "gallery", "hobbies"];
  const sections = await Promise.all(keys.map(async (k) => {
    const { data } = await supabase.from(LIST_SECTIONS[k].table as ListTable).select("status, updated_at");
    const rows = (data ?? []) as { status: string; updated_at: string }[];
    return { k, rows, live: rows.filter((r) => r.status === "published").length };
  }));
  const [{ data: profile }, { data: testimonials }, { count: unread }] = await Promise.all([
    supabase.from("profile").select("name, headline, updated_at").single(),
    supabase.from("testimonials").select("id, name, kind, state, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  const published = sections.reduce((n, s) => n + s.live, 0);
  const drafts = sections.reduce((n, s) => n + s.rows.filter((r) => r.status === "draft").length, 0);
  const pending = (testimonials ?? []).filter((t) => t.state === "pending");
  const last = sections.flatMap((s) => s.rows.map((r) => ({ k: s.k, at: r.updated_at }))).sort((a, b) => b.at.localeCompare(a.at))[0];

  const attention = [
    !profile?.name && { href: "/profile", text: "Your profile has no name or headline yet", cta: "Fill it in" },
    pending.length > 0 && { href: "/testimonials", text: `${pending.length} testimonial${pending.length > 1 ? "s" : ""} waiting for review`, cta: "Review" },
    (unread ?? 0) > 0 && { href: "/messages", text: `${unread} unread contact message${unread! > 1 ? "s" : ""}`, cta: "Open inbox" },
    drafts > 0 && { href: "/projects", text: `${drafts} draft${drafts > 1 ? "s" : ""} not on the site yet`, cta: "Finish" },
  ].filter(Boolean) as { href: string; text: string; cta: string }[];

  return (
    <>
      <div className="page-head">
        <div><div className="kicker">Overview</div><h1>Welcome back{profile?.name ? `, ${profile.name}` : ""}</h1>
          <p>{published ? `${published} items are live on your portfolio.` : "Nothing is published yet — start with your profile, then add projects."}</p></div>
        <div className="actions">
          <Link className="btn" href="/testimonials"><Icon name="quote" /> Testimonials</Link>
          <Link className="btn primary" href="/projects"><Icon name="plus" /> New project</Link>
        </div>
      </div>

      <div className="grid stats">
        <div className="card stat"><span className="muted">Published items</span><b>{published}</b><small>across {keys.length} sections</small></div>
        <div className="card stat"><span className="muted">Drafts</span><b>{drafts}</b><small>not on the site yet</small></div>
        <div className="card stat"><span className="muted">Pending testimonials</span><b>{pending.length}</b><small>{(testimonials ?? []).filter((t) => t.state === "approved").length} published</small></div>
        <div className="card stat"><span className="muted">Last edit</span><b style={{ fontSize: 22, marginTop: 12 }}>{last ? ago(last.at) : "—"}</b><small>{last ? LIST_SECTIONS[last.k].label : "no content yet"}</small></div>
      </div>

      <h2 style={{ fontSize: 18, margin: "26px 0 12px" }}>Portfolio sections</h2>
      <div className="grid section-tiles">
        <Link className="card tile" href="/profile"><span className="ic"><Icon name="user" /></span><b>Profile & About</b><span className="faint" style={{ fontSize: 12 }}>{profile?.name ? "Filled in" : "Empty"}</span><div className="bar"><i style={{ width: profile?.name ? "100%" : "0%" }} /></div></Link>
        {sections.map(({ k, rows, live }) => {
          const pct = rows.length ? Math.round((live / rows.length) * 100) : 0;
          return (
            <Link className="card tile" key={k} href={`/${k}`}><span className="ic"><Icon name={LIST_SECTIONS[k].icon} /></span><b>{LIST_SECTIONS[k].label}</b>
              <span className="faint" style={{ fontSize: 12 }}>{rows.length} item{rows.length === 1 ? "" : "s"} · {pct}% live</span><div className="bar"><i style={{ width: `${pct}%` }} /></div></Link>
          );
        })}
        <Link className="card tile" href="/testimonials"><span className="ic"><Icon name="quote" /></span><b>Testimonials</b><span className="faint" style={{ fontSize: 12 }}>{(testimonials ?? []).length} collected</span><div className="bar"><i style={{ width: "100%" }} /></div></Link>
        <Link className="card tile" href="/cafe"><span className="ic"><Icon name="coffee" /></span><b>3D café</b><span className="faint" style={{ fontSize: 12 }}>Signs, panels, credits</span><div className="bar"><i style={{ width: "100%" }} /></div></Link>
      </div>

      <div className="grid two">
        <div className="card"><div className="card-head"><h2>Recent testimonials</h2></div>
          {(testimonials ?? []).length ? (
            <ul className="feed">{(testimonials ?? []).slice(0, 5).map((t) => (
              <li key={t.id}><span className="ic"><Icon name={t.kind === "text" ? "text" : t.kind} /></span><div><b>{t.name}</b> sent a {t.kind} testimonial<div className="faint" style={{ fontSize: 12 }}>{ago(t.created_at)} · {t.state}</div></div></li>
            ))}</ul>
          ) : <div className="empty" style={{ padding: 28 }}>No testimonials yet. Send a request from Testimonials.</div>}
        </div>
        <div className="card"><div className="card-head"><h2>Needs attention</h2></div>
          {attention.length ? (
            <ul className="feed">{attention.map((a) => (
              <li key={a.href + a.text}><span className="ic"><Icon name="info" /></span><div>{a.text}<div><Link href={a.href} style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>{a.cta} →</Link></div></div></li>
            ))}</ul>
          ) : <div className="empty" style={{ padding: 28 }}>All caught up.</div>}
        </div>
      </div>
    </>
  );
}
