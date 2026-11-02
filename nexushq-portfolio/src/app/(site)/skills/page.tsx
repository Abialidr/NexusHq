import type { Metadata } from "next";
import Page from "@/components/motion/Page";
import { getPortfolioContent } from "@/lib/content/get-portfolio-content";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const { skills, profile } = await getPortfolioContent();
  return (
    <Page>
      <header className="page-head">
        <span className="kicker">Skills</span>
        <h1 className="h-page">What I work with</h1>
        <p className="lead">Technologies and tools from my work and hands-on projects, grouped by area.</p>
      </header>

      <section className="grid g2" style={{ gap: 24, marginBottom: 56 }}>
        {skills.map((g) => (
          <div className="card skill-group" key={g.title}>
            <h3>{g.title}</h3>
            <div className="skill-list">{g.skills.map((s) => <span className="skill" key={s}><i />{s}</span>)}</div>
          </div>
        ))}
      </section>

      {profile.principles.length > 0 && <section className="section">
        <h2 className="h-sec" style={{ marginBottom: 8 }}>How I work</h2>

        <div className="grid g3">
          {profile.principles.map((p, i) => (
            <div className="card" key={i}><span className="mono muted">{String(i + 1).padStart(2, "0")}</span><h3 className="h-card">{p.title}</h3><p className="muted small">{p.body}</p></div>
          ))}
        </div>
      </section>}
    </Page>
  );
}
