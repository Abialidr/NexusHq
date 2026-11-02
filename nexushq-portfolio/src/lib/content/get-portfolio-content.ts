import { cacheLife } from "next/cache";
import type { PortfolioContent } from "@/types/portfolio";
import { readPortfolioContent } from "./read-supabase-content";

// Published Supabase content shared by the 2D pages. RLS and explicit status filters
// keep admin drafts private; the short cache allows updates without rebuilding.





export async function getPortfolioContent(): Promise<PortfolioContent> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  return readPortfolioContent();
}

export async function getProject(slug: string) {
  const { projects } = await getPortfolioContent();
  return projects.find((p) => p.slug === slug);
}

export async function getArticle(slug: string) {
  const { articles } = await getPortfolioContent();
  return articles.find((a) => a.slug === slug);
}
