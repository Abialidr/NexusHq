"use client";

import { useState } from "react";
import ProjectCard from "./ProjectCard";
import type { PortfolioProject } from "@/types/portfolio";

const FILTERS: Array<{ id: "all" | PortfolioProject["category"]; label: string }> = [
  { id: "all", label: "All" },
  { id: "web", label: "Web apps" },
  { id: "ai", label: "AI & agents" },
  { id: "platform", label: "Cloud & platform" },
];

export default function ProjectBrowser({ projects }: { projects: PortfolioProject[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const shown = projects.filter((p) => filter === "all" || p.category === filter);

  return (
    <>
      <div className="row filters" role="group" aria-label="Filter projects">
        {FILTERS.map((f) => (
          <button key={f.id} className={`btn ${filter === f.id ? "btn-primary" : "btn-ghost"}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      <section className="grid g3" style={{ margin: "28px 0 48px" }} aria-live="polite">
        {shown.map((p) => <ProjectCard key={p.slug} project={p} showYear />)}
        {shown.length === 0 && <p className="empty">Nothing in this category yet.</p>}
      </section>
    </>
  );
}
