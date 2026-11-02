export default function Loading() {
  return (
    <section className="project-loading" role="status" aria-label="Loading project">
      <span className="sr-only">Loading project</span>
      <div aria-hidden="true" className="stack">
        <div className="skeleton skeleton-kicker" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-cover" />
        <div className="skeleton skeleton-line" />
      </div>
    </section>
  );
}
