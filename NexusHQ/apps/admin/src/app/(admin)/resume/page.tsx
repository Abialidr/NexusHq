import Link from "next/link";
import ResumeSheet, { PrintButton, type ResumeData } from "@/components/ResumeSheet";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JobDraft } from "@nexushq/shared";

export const metadata = { title: "Resume" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Upwork cockpit → Resume (roadmap H2/H3). Without ?job= it's your base resume, built from the published admin data.
// With ?job=<id> it's the version the Writer tailored to that job. Print (Save as PDF) gives the file to upload.
export default async function ResumePage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  await requireAdmin();
  const { job } = await searchParams;
  const supabase = await createClient();
  const pub = <T,>(q: PromiseLike<{ data: T[] | null }>) => q.then((r) => r.data ?? []);
  const [profile, skills, exp, edu, proj, jobRow] = await Promise.all([
    supabase.from("profile").select("name, role, headline, intro, location, email, socials, availability").maybeSingle().then((r) => r.data),
    pub(supabase.from("skill_groups").select("title, skills").eq("status", "published").order("sort_order")),
    pub(supabase.from("experiences").select("role, company, start_label, end_label, place, summary, highlights").eq("status", "published").order("sort_order")),
    pub(supabase.from("education").select("title, org, when_label").eq("status", "published").order("sort_order")),
    pub(supabase.from("projects").select("name, kind, summary, skills, results").eq("status", "published").order("sort_order")),
    job && UUID_RE.test(job) ? supabase.from("jobs").select("title, url, draft").eq("id", job).maybeSingle().then((r) => r.data) : null,
  ]);

  const tailored = (jobRow?.draft as JobDraft | null)?.resume;
  const socials = Array.isArray(profile?.socials) ? (profile.socials as { label?: string; url?: string }[]) : [];
  const data: ResumeData = {
    name: profile?.name ?? "", role: profile?.role ?? "",
    contact: [profile?.location, profile?.email, ...socials.map((s) => s.url)].filter(Boolean) as string[],
    headline: tailored?.headline ?? profile?.headline ?? "",
    summary: tailored?.summary ?? profile?.intro ?? "",
    skills: tailored?.skills ?? skills.flatMap((g) => g.skills ?? []),
    experience: tailored?.experience ?? exp.map((e) => ({
      role: e.role, company: e.company, period: `${e.start_label}${e.start_label ? " – " : ""}${e.end_label || "present"}`,
      bullets: (e.highlights?.length ? e.highlights : e.summary ? [e.summary] : []).slice(0, 4),
    })),
    projects: tailored?.projects ?? proj.slice(0, 5).map((p) => ({ name: p.kind ? `${p.name} (${p.kind})` : p.name, line: p.summary })),
    education: edu.map((e) => ({ title: e.title, org: e.org, when: e.when_label })),
  };
  const empty = !data.name && !data.experience.length && !data.projects.length;

  return (
    <>
      <div className="page-head no-print">
        <div>
          <div className="kicker">Upwork cockpit</div><h1>{jobRow ? "Tailored resume" : "Resume"}</h1>
          <p>
            {jobRow
              ? tailored
                ? <>Tailored by the Writer for <b>{jobRow.title}</b>. Only facts from your admin profile are used; check it before sending.</>
                : <>This job&rsquo;s draft has no tailored resume yet (it was written before this feature). Press <b>Rewrite draft</b> in the Job radar; until then this is your base resume.</>
              : <>Built from your published profile, experience, projects, skills and education. Update those pages and this updates too.</>}
          </p>
        </div>
        <div className="actions">
          {jobRow && <Link className="btn ghost" href="/resume">Base resume</Link>}
          {jobRow?.url && <a className="btn ghost" href={jobRow.url} target="_blank" rel="noreferrer">Open job ↗</a>}
          <PrintButton />
        </div>
      </div>
      {empty
        ? <div className="card empty">Nothing published yet. Fill in Profile, Experience and Projects and set them to Published.</div>
        : <ResumeSheet data={data} />}
    </>
  );
}
