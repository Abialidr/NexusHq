import type { Metadata } from "next";
import Page from "@/components/motion/Page";
import { getPortfolioContent } from "@/lib/content/get-portfolio-content";

export const metadata: Metadata = { title: "Open source" };

export default async function OpenSourcePage() {
  const { openSource } = await getPortfolioContent();
  return (
    <Page>
      <header className="page-head">
        <span className="kicker">Open source</span>
        <h1 className="h-page">Free for everyone</h1>
        <p className="lead">Things I have contributed to or released in the open.</p>
      </header>
      {openSource.length === 0 && <p className="empty">No open-source work published yet.</p>}
      <section style={{ marginBottom: 56 }}>
        {openSource.map((o, i) => (
          <a className="list-row" href={o.url} key={i}>
            <span className="mono muted">{o.relation}</span>
            <div className="stack" style={{ gap: 4 }}><h3 className="h-card">{o.name}</h3><p className="muted small">{o.summary}</p></div>
            <span className="chip">{o.badge}</span>
          </a>
        ))}
      </section>
    </Page>
  );
}
