import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Page from "@/components/motion/Page";
import TestimonialCards from "@/components/site/TestimonialCards";
import { getPortfolioContent, getProject } from "@/lib/content/get-portfolio-content";



export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const project = await getProject((await params).slug);
  return { title: project ? project.name : "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const { projects, testimonials } = await getPortfolioContent();
  const more = projects.filter((p) => p.slug !== slug).slice(0, 2);
  const gallery = (project.media ?? []).filter((item) => item.url !== project.coverImageUrl);

  return (
    <Page>
      <header className="page-head">
        <Link className="link small" href="/projects">← All projects</Link>
        <span className="kicker">Case study · {project.kind}</span>
        <h1 className="h-page">{project.name}</h1>
        <p className="lead">{project.summary}</p>
        <div className="row">{project.links.map((link, i) => (
          <a key={link.label} className={`btn ${i === 0 ? "btn-primary" : "btn-ghost"}`} href={link.url}>{link.label} ↗</a>
        ))}</div>
      </header>

      {project.coverImageUrl && <img src={project.coverImageUrl} alt={`${project.name} overview`} style={{ width: "100%", height: "auto", borderRadius: 20, marginBottom: 32 }} />}

      <div className="facts" style={{ marginBottom: 56 }}>
        {project.role && <div><span>Role</span><b>{project.role}</b></div>}
        {project.timeline && <div><span>Timeline</span><b>{project.timeline}</b></div>}
        {project.team && <div><span>Team</span><b>{project.team}</b></div>}
        {project.skills.length > 0 && <div><span>Stack</span><b>{project.skills.join(" · ")}</b></div>}
      </div>

      <article className="prose" style={{ marginBottom: 56 }}>
        {project.problem && <><h2>The problem</h2><p>{project.problem}</p></>}
        {project.built && <><h2>What I built</h2><p>{project.built}</p></>}
        {project.decisions.length > 0 && <ul>{project.decisions.map((decision, i) => <li key={i}>{decision}</li>)}</ul>}
        {project.quote && !testimonials.some((item) => item.projectSlug === slug) && <blockquote>{project.quote}</blockquote>}
        {project.results && <><h2>Results</h2><p>{project.results}</p></>}
      </article>

      <TestimonialCards items={testimonials} projectSlug={slug} title="Client feedback" />

      {gallery.length > 0 && <section className="section">
        <h2 className="h-sec" style={{ marginBottom: 24 }}>Screenshots and demonstrations</h2>
        <div className="grid g2">{gallery.map((item, i) => (
          <figure key={item.url + i} className="stack" style={{ gap: 8 }}>
            {item.kind === "video"
              ? <video controls preload="none" src={item.url} aria-label={item.label || project.name + " demo"} style={{ width: "100%", borderRadius: 12 }} />
              : <a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={item.label || project.name + " screenshot"} loading="lazy" style={{ width: "100%", height: "auto", borderRadius: 12 }} /></a>}
            {item.label && <figcaption className="small muted">{item.label}</figcaption>}
          </figure>
        ))}</div>
      </section>}

      {more.length > 0 && <section className="section">
        <div className="row between" style={{ marginBottom: 24 }}><h2 className="h-sec">More projects</h2><Link className="link" href="/projects">All projects →</Link></div>
        <div className="grid g2">{more.map((p) => (
          <Link className="card" key={p.slug} href={`/projects/${p.slug}`}><span className="kicker">{p.kind}</span><h3 className="h-card">{p.name}</h3><span className="arrow">View →</span></Link>
        ))}</div>
      </section>}
    </Page>
  );
}
