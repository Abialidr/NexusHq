import type { PortfolioContent } from "@/types/portfolio";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => item !== null && typeof item === "object" && !Array.isArray(item)) : [];
}
function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] as string : "";
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
export function assetUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return undefined;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return base ? base + "/storage/v1/object/public/portfolio/" + value.split("/").map(encodeURIComponent).join("/") : undefined;
}
function links(value: unknown) {
  return rows(value).map((item) => ({ label: text(item, "label"), url: text(item, "url") }))
    .filter((item) => item.label && /^https?:\/\//i.test(item.url));
}
async function readTable(table: string, filters: Record<string, string> = {}): Promise<Row[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error("Portfolio Supabase URL and publishable key are not configured.");
  const query = new URLSearchParams({ select: "*", ...filters });
  const response = await fetch(base.replace(/\/$/, "") + "/rest/v1/" + table + "?" + query, {
    headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Unable to load portfolio " + table + " (HTTP " + response.status + ").");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid portfolio response for " + table + ".");
  return rows(data);
}
export async function readPortfolioContent(): Promise<PortfolioContent> {
  const published = { status: "eq.published", order: "sort_order.asc,id.asc" };
  const [profiles, projects, experience, education, skills, openSource, articles, hobbies, photos, testimonials] = await Promise.all([
    readTable("profile", { id: "eq.true" }), readTable("projects", published),
    readTable("experiences", published), readTable("education", published),
    readTable("skill_groups", published), readTable("open_source", published),
    readTable("articles", published), readTable("hobbies", published),
    readTable("gallery_photos", published), readTable("testimonials", { state: "eq.approved", consent: "eq.true" }),
  ]);
  const p = profiles[0];
  if (!p) throw new Error("Portfolio profile has not been configured.");
  return {
    profile: {
      name: text(p,"name"), role: text(p,"role"), headline: text(p,"headline"), intro: text(p,"intro"),
      story: strings(p.story), location: text(p,"location"), workMode: text(p,"work_mode"),
      currently: text(p,"currently"), availability: text(p,"availability"), email: text(p,"email"),
      avatarUrl: assetUrl(p.avatar_path), resumeUrl: assetUrl(p.resume_path), socials: links(p.socials),
      stack: strings(p.stack), contactHeadline: text(p,"contact_headline"), contactLead: text(p,"contact_lead"),
      contactReply: text(p,"contact_reply"), contactFormEnabled: p.contact_form_enabled === true,
      stats: rows(p.stats).filter((s)=>typeof s.value === "number" && Number.isFinite(s.value)).map((s)=>({
        value:s.value as number, prefix:text(s,"prefix"), suffix:text(s,"suffix"), label:text(s,"label"),
      })),
      principles: rows(p.principles).map((s)=>({title:text(s,"title"),body:text(s,"body")})),
      hobbies: hobbies.map((h)=>({title:text(h,"title"),body:text(h,"body")})),
      photos: photos.filter((photo)=>["about","both","all"].includes(text(photo,"placement"))).map((photo)=>({url:assetUrl(photo.path),caption:text(photo,"caption")})),
    },
    testimonials: testimonials.filter((r) => r.kind === "text" && text(r, "quote")).sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)).map((r) => {
      const project = projects.find((p) => p.id === r.project_id);
      const source = text(r, "source_url");
      return {
        id: text(r, "id"), name: text(r, "name"), role: text(r, "role"), quote: text(r, "quote"),
        pullQuote: text(r, "pull_quote") || text(r, "quote"),
        rating: typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5 ? r.rating : undefined,
        avatarUrl: assetUrl(r.avatar_path), sourceLabel: text(r, "source_label"),
        sourceUrl: /^https?:\/\//i.test(source) ? source : undefined,
        reviewedOn: text(r, "reviewed_on") || undefined, placements: strings(r.placements),
        projectSlug: project ? text(project, "slug") : undefined,
        projectName: project ? text(project, "name") : undefined,
      };
    }),
    projects: projects.map((r)=>{
      const quote = testimonials.find((t)=>t.id === r.quote_testimonial_id);
      return {
        slug:text(r,"slug"),name:text(r,"name"),kind:text(r,"kind"),
        category:r.category === "ai" || r.category === "platform" ? r.category : "web",
        year:text(r,"year"),summary:text(r,"summary"),featured:r.featured === true,
        coverImageUrl:assetUrl(r.cover_path),skills:strings(r.skills),links:links(r.links),
        role:text(r,"role"),timeline:text(r,"timeline"),team:text(r,"team"),problem:text(r,"problem"),
        built:text(r,"built"),decisions:strings(r.decisions),results:text(r,"results"),
        quote:quote ? text(quote,"pull_quote") || text(quote,"quote") : undefined,
        media:rows(r.media).filter((m)=>m.kind === "image" || m.kind === "video").flatMap((m)=>{
          const url = assetUrl(m.path);
          return url ? [{kind:m.kind as "image" | "video",url,label:text(m,"label")}] : [];
        }),
      };
    }),
    experience:experience.map((r)=>({slug:text(r,"slug"),role:text(r,"role"),company:text(r,"company"),
      from:text(r,"start_label"),to:text(r,"end_label") || "Present",place:text(r,"place"),
      type:text(r,"employment_type"),summary:text(r,"summary"),highlights:strings(r.highlights),skills:strings(r.skills)})),
    education:education.map((r)=>({title:text(r,"title"),org:text(r,"org"),when:text(r,"when_label"),subjects:strings(r.subjects)})),
    skills:skills.map((r)=>({title:text(r,"title"),skills:strings(r.skills)})),
    openSource:openSource.map((r)=>({name:text(r,"name"),relation:text(r,"relation"),summary:text(r,"summary"),badge:text(r,"badge"),url:text(r,"url")})),
    articles:articles.map((r)=>({slug:text(r,"slug"),title:text(r,"title"),date:text(r,"published_on"),
      readMinutes:typeof r.read_minutes === "number" ? r.read_minutes : 0,summary:text(r,"summary"),coverImageUrl:assetUrl(r.cover_path),
      body:text(r,"body_md").split(/\n\s*\n/).filter(Boolean).map((block)=>({
        type:block.startsWith("## ") ? "h2" as const : block.startsWith("> ") ? "quote" as const : block.startsWith("```") ? "code" as const : "p" as const,
        text:block.replace(/^## |^> /,"").replace(/^```[^\n]*\n?|\n?```$/g,""),
      })),
    })),
  };
}
