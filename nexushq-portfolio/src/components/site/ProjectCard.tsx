import Link from "next/link";
import type { PortfolioProject } from "@/types/portfolio";

export default function ProjectCard({ project, showYear = false }: { project: PortfolioProject; showYear?: boolean }) {
  return (
    <Link className="card" href={`/projects/${project.slug}`}>
      {project.coverImageUrl && <img className="thumb" src={project.coverImageUrl} alt={`${project.name} preview`} loading="lazy" style={{ width: "100%", objectFit: "cover" }} />}
      <span className="kicker">{project.kind}{showYear ? ` · ${project.year}` : ""}</span>
      <h3 className="h-card">{project.name}</h3>
      <p className="muted small">{project.summary}</p>
      <div className="row">{project.skills.slice(0, 3).map((s) => <span className="chip" key={s}>{s}</span>)}</div>
    </Link>
  );
}
