import type { Metadata } from "next";
import Link from "next/link";
import Page from "@/components/motion/Page";
import { getPortfolioContent } from "@/lib/content/get-portfolio-content";

export const metadata: Metadata = { title: "Articles" };

export default async function ArticlesPage() {
  const { articles } = await getPortfolioContent();
  const [latest, ...rest] = articles;
  return (
    <Page>
      <header className="page-head">
        <span className="kicker">Articles</span>
        <h1 className="h-page">Notes from the work</h1>
        <p className="lead">Things I have written about building products, AI agents and the cloud.</p>
      </header>
      {latest && (
        <Link className="card split-card" href={`/articles/${latest.slug}`}>
          {latest.coverImageUrl && <img src={latest.coverImageUrl} alt={latest.title} style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover" }} />}
          <div className="stack" style={{ gap: 12 }}>
            <span className="kicker">Latest · {latest.date}</span><h2 className="h-sec">{latest.title}</h2>
            <p className="muted">{latest.summary}</p><span className="arrow">Read it →</span>
          </div>
        </Link>
      )}
      {articles.length === 0 && <p className="empty">No articles published yet.</p>}
      <section style={{ marginBottom: 56 }}>
        {rest.map((a) => (
          <Link className="list-row" href={`/articles/${a.slug}`} key={a.slug}>
            <span className="mono muted">{a.date}</span>
            <div className="stack" style={{ gap: 4 }}><h3 className="h-card">{a.title}</h3><p className="muted small">{a.summary}</p></div>
            <span className="small muted">{a.readMinutes} min</span>
          </Link>
        ))}
      </section>
    </Page>
  );
}
