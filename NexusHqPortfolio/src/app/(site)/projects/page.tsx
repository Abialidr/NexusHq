import type { Metadata } from "next";
import Link from "next/link";
import Page from "@/components/motion/Page";
import TestimonialCards from "@/components/site/TestimonialCards";
import ProjectBrowser from "@/components/site/ProjectBrowser";
import { getPortfolioContent } from "@/lib/content/get-portfolio-content";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { projects, testimonials } = await getPortfolioContent();
  const featured = projects.find((p) => p.featured);
  const rest = projects.filter((p) => p !== featured);

  return (
    <Page>
      <header className="page-head">
        <span className="kicker">Projects</span>
        <h1 className="h-page">Things I have built</h1>
        <p className="lead">Web applications and platforms, from interfaces to backend services.</p>
      </header>

      {featured && (
        <Link className="card featured-card" href={`/projects/${featured.slug}`}>
          {featured.coverImageUrl && <img className="thumb" src={featured.coverImageUrl} alt={`${featured.name} preview`} style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover" }} />}
          <div className="stack" style={{ gap: 14 }}>
            <span className="chip accent" style={{ alignSelf: "flex-start" }}>Featured</span>
            <h2 className="h-sec">{featured.name}</h2>
            <p className="muted">{featured.summary}</p>
            <div className="row">{featured.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
            <span className="arrow">Read the case study →</span>
          </div>
        </Link>
      )}

      <ProjectBrowser projects={rest} />
      <TestimonialCards items={testimonials} placement="projects" />
    </Page>
  );
}
