import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Page from "@/components/motion/Page";
import { getArticle, getPortfolioContent } from "@/lib/content/get-portfolio-content";



export async function generateMetadata({ params }: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const article = await getArticle((await params).slug);
  return { title: article ? article.title : "Article" };
}

function ArticleInline({ text }: { text: string }) {
  return text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*\n]+\*)/g).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default async function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  const article = await getArticle((await params).slug);
  if (!article) notFound();
  const { profile } = await getPortfolioContent();

  return (
    <Page className="wrap narrow">
      <header className="page-head">
        <Link className="link small" href="/articles">← All articles</Link>
        <span className="kicker">{article.date} · {article.readMinutes} min read</span>
        <h1 className="h-page">{article.title}</h1>
        <p className="lead">{article.summary}</p>
      </header>
      {article.coverImageUrl && !article.body.some((b) => b.text.match(/^!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)$/)?.[1] === article.coverImageUrl) && <img src={article.coverImageUrl} alt={article.title} style={{ width: "100%", height: "auto", marginBottom: 40 }} />}
      <article className="prose" style={{ marginBottom: 56 }}>
        {article.body.map((b, i) => {
          if (b.type === "code") return <pre key={i} className="mono code-block">{b.text}</pre>;
          const image = b.type === "p" && b.text.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
          if (image) return <figure key={i} style={{ margin: "32px 0" }}><img src={image[2]} alt={image[1]} loading="lazy" style={{ width: "100%", height: "auto", borderRadius: 12 }} /></figure>;
          return b.type === "h2" ? <h2 key={i}><ArticleInline text={b.text} /></h2>
            : b.type === "quote" ? <blockquote key={i}><ArticleInline text={b.text} /></blockquote>
            : <p key={i}><ArticleInline text={b.text} /></p>;
        })}
      </article>
      <div className="card row between" style={{ flexDirection: "row", marginBottom: 24 }}>
        <div className="stack" style={{ gap: 2 }}><b>Written by {profile.name}</b><span className="muted small">{profile.role}</span></div>
        <Link className="btn btn-ghost" href="/contact">Get in touch</Link>
      </div>
    </Page>
  );
}
