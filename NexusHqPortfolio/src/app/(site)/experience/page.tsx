import type { Metadata } from "next";
import Page from "@/components/motion/Page";
import { getPortfolioContent } from "@/lib/content/get-portfolio-content";

export const metadata: Metadata = { title: "Experience" };

export default async function ExperiencePage() {
  const { profile, experience, education } = await getPortfolioContent();
  return (
    <Page>
      <header className="page-head">
        <span className="kicker">Experience</span>
        <h1 className="h-page">Where I have worked</h1>
        <p className="lead">My work across web applications, backend services, and cloud deployments, newest first.</p>
        {profile.resumeUrl && <div className="row"><a className="btn btn-ghost" href={profile.resumeUrl}>Download résumé (PDF)</a></div>}
      </header>

      <section className="timeline" style={{ marginBottom: 48 }}>
        {experience.map((e) => (
          <article className="tl-item" key={e.slug}>
            <div className="stack" style={{ gap: 10 }}>
              <div className="tl-logo" aria-hidden="true">{e.company.replace(/[^A-Za-z]/g, "").charAt(0) || "·"}</div>
              <span className="tl-when">{e.from} — {e.to}<br />{e.place}</span>
            </div>
            <div className="tl-body">
              <div className="row between"><h2 className="h-card" style={{ fontSize: 24 }}>{e.role}</h2><span className={`chip${e.type === "Full-time" ? " sage" : ""}`}>{e.type}</span></div>
              <b className="muted">{e.company}</b>
              <p className="muted">{e.summary}</p>
              <ul>{e.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
              <div className="row">{e.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="section">
        <h2 className="h-sec" style={{ marginBottom: 24 }}>Education</h2>
        <div className="grid g2">
          {education.map((ed, i) => (
            <div className="card" key={i}>
              <span className="kicker">{ed.when}</span><h3 className="h-card">{ed.title}</h3><p className="muted small">{ed.org}</p>
              {ed.subjects.length > 0 && <div className="row">{ed.subjects.map((s, j) => <span className="chip" key={j}>{s}</span>)}</div>}
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
