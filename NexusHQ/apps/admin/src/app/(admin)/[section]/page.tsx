import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import SectionList from "@/components/SectionList";
import { requireAdmin } from "@/lib/auth";
import { LIST_SECTIONS, type ListTable } from "@/lib/sections";
import { createClient } from "@/lib/supabase/server";

// Sidebar entries that are planned but not built yet.
const LATER: Record<string, { label: string; icon: string; group: string; note: string }> = {
  jobs: { label: "Job radar", icon: "bolt", group: "Upwork cockpit", note: "The local agent’s job radar. Designed and built in its own workflow later." },
  proposals: { label: "Proposals", icon: "pen", group: "Upwork cockpit", note: "AI-drafted proposals for review. Designed and built later." },
  users: { label: "Users & roles", icon: "shield", group: "Settings", note: "Only the Admin role exists today. It is granted in Supabase by setting app_metadata.role = 'admin' on a user (see apps/admin/README.md)." },
  site: { label: "Site settings", icon: "gear", group: "Settings", note: "SEO defaults and the entry modal. The 3D café texts already live under Portfolio → 3D café." },
};

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  return { title: LIST_SECTIONS[section]?.label ?? LATER[section]?.label ?? "Not found" };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdmin();
  const { section } = await params;

  const later = LATER[section];
  if (later) {
    return (
      <>
        <div className="page-head"><div><div className="kicker">{later.group}</div><h1>{later.label}</h1></div></div>
        <div className="card empty"><Icon name={later.icon} /><h2 style={{ fontSize: 18, margin: "10px 0 6px" }}>Coming later</h2><p>{later.note}</p></div>
      </>
    );
  }

  const def = LIST_SECTIONS[section];
  if (!def) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.from(def.table as ListTable).select("*").order("sort_order").order("created_at");
  if (error) throw new Error(error.message);

  // Projects can quote an approved testimonial.
  let options;
  if (section === "projects") {
    const { data: t } = await supabase.from("testimonials").select("id, name, pull_quote, quote").eq("state", "approved").order("created_at", { ascending: false });
    options = { quote_testimonial_id: (t ?? []).map((x) => ({ value: x.id, label: `${x.name}: “${(x.pull_quote || x.quote).slice(0, 60)}”` })) };
  }

  return <SectionList key={section} section={section} rows={(data ?? []) as never} options={options} />;
}
