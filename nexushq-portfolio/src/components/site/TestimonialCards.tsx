import Link from "next/link";
import type { PortfolioTestimonial } from "@/types/portfolio";
import styles from "./TestimonialCards.module.css";

export default function TestimonialCards({ items, placement, projectSlug, title = "What people say" }: {
  items: PortfolioTestimonial[];
  placement?: string;
  projectSlug?: string;
  title?: string;
}) {
  const visible = items.filter((item) => projectSlug ? item.projectSlug === projectSlug : !placement || item.placements.includes(placement));
  if (!visible.length) return null;

  return (
    <section className="section" aria-label={title}>
      <h2 className="h-sec" style={{ marginBottom: 24 }}>{title}</h2>
      <div className={styles.grid}>
        {visible.map((item) => (
          <article className={`card ${styles.card}`} key={item.id}>
            <header className={styles.person}>
              {item.avatarUrl && <img className={styles.avatar} src={item.avatarUrl} alt={item.name} loading="lazy" width={56} height={56} />}
              <div><h3 className={styles.name}>{item.name}</h3><p className="small muted">{item.role}</p></div>
            </header>
            {item.rating && <span className={styles.rating} role="img" aria-label={`${item.rating} out of 5 stars`}><span aria-hidden="true">{"★".repeat(Math.round(item.rating))}{"☆".repeat(5 - Math.round(item.rating))}</span></span>}
            <blockquote className={styles.quote}>“{item.pullQuote}”</blockquote>
            {item.quote !== item.pullQuote && <details className={styles.details}>
              <summary>Read full testimonial</summary>
              <div className={styles.fullReview}>{item.quote}</div>
            </details>}
            <footer className={styles.footer}>
              {item.projectSlug && <Link className="link small" href={`/projects/${item.projectSlug}`}>{item.projectName} →</Link>}
              {item.sourceUrl && <a className="link small" href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceLabel || "Original review"} ↗</a>}
              {item.reviewedOn && <time className="small muted" dateTime={item.reviewedOn}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(item.reviewedOn + "T00:00:00Z"))}</time>}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
