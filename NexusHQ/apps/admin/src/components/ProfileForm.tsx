"use client";

// The single profile record: Home hero, About story, availability, Home stats/tech strip, Contact page copy, socials.
import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { useToast } from "@/components/ui";
import { FieldGroups, type Values } from "@/components/Fields";
import type { FieldGroup } from "@/lib/sections";
import { saveProfile } from "@/app/actions";

const GROUPS: FieldGroup[] = [
  { group: "Identity", fields: [
    { k: "name", label: "Display name", type: "text" },
    { k: "role", label: "Role line", type: "text", placeholder: "Full-stack engineer" },
    { k: "headline", label: "Hero headline", type: "text", full: true },
    { k: "intro", label: "Intro", type: "textarea", full: true },
    { k: "avatar_path", label: "Portrait", type: "image", full: true },
  ] },
  { group: "About story", fields: [{ k: "story", label: "Story paragraphs", type: "lines", full: true }] },
  { group: "Availability", fields: [
    { k: "location", label: "Location", type: "text" },
    { k: "work_mode", label: "Work mode", type: "select", opts: ["Remote", "Hybrid", "On-site"] },
    { k: "availability", label: "Availability", type: "select", opts: ["Open to work", "Limited", "Booked"] },
    { k: "currently", label: "Currently", type: "text", hint: "“Currently brewing …” on Home and in the café" },
    { k: "email", label: "Public email", type: "text" },
    { k: "resume_path", label: "Résumé (PDF)", type: "image", hint: "PDF — shown as “Download CV”" },
  ] },
  { group: "Home page", fields: [{ k: "stack", label: "Tech strip (scrolling marquee on Home)", type: "tags", full: true }] },
  { group: "Contact page", fields: [
    { k: "contact_headline", label: "Headline", type: "text", full: true },
    { k: "contact_lead", label: "Intro line", type: "textarea", full: true },
    { k: "contact_reply", label: "Reply time", type: "text", placeholder: "I usually reply within a day." },
    { k: "contact_form_enabled", label: "Contact form", type: "toggle" },
  ] },
  { group: "Social links", fields: [{ k: "socials", label: "Links (also printed on the café business cards)", type: "links", full: true }] },
];

type Principle = { title: string; body: string };
type Stat = { value: number | string; prefix: string; suffix: string; label: string };

export default function ProfileForm({ initial }: { initial: Values }) {
  const toast = useToast();
  const [values, setValues] = useState<Values>(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: string, v: unknown) => setValues((x) => ({ ...x, [k]: v }));

  const principles = (values.principles as Principle[]) ?? [];
  const stats = (values.stats as Stat[]) ?? [];

  const save = () => start(async () => {
    setError("");
    const res = await saveProfile(values);
    if (res.ok) toast("Profile published"); else setError(res.error);
  });

  return (
    <>
      <div className="page-head">
        <div><div className="kicker">Portfolio</div><h1>Profile & About</h1><p>Who you are: the hero on Home, the About story, availability, contact copy and social links.</p></div>
        <div className="actions">
          {error && <span className="err">{error}</span>}
          <button className="btn primary" onClick={save} disabled={pending}><Icon name="check" /> {pending ? "Saving…" : "Publish changes"}</button>
        </div>
      </div>
      <div className="notice"><Icon name="info" /><div>One profile record feeds the Home hero, About page, Contact page, footer and the café’s barista panel and business cards.</div></div>

      <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <FieldGroups groups={GROUPS.slice(0, 2)} values={values} set={set} folder="profile" />

        <fieldset className="fieldset"><legend>Principles</legend>
          <div className="repeat">
            {(principles.length ? principles : [{ title: "", body: "" }]).map((p, i, all) => (
              <div className="pair-row" key={i}>
                <input className="input" placeholder="Calm over clever" value={p.title} onChange={(e) => set("principles", all.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <input className="input" placeholder="Boring tech, shipped well." value={p.body} onChange={(e) => set("principles", all.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
                <button className="icon-btn" aria-label="Remove principle" onClick={() => set("principles", all.filter((_, j) => j !== i))}><Icon name="x" /></button>
              </div>
            ))}
            <button className="add-row" onClick={() => set("principles", [...principles, { title: "", body: "" }])}><Icon name="plus" /> Add principle</button>
          </div>
        </fieldset>

        <FieldGroups groups={GROUPS.slice(2, 3)} values={values} set={set} folder="profile" />

        <fieldset className="fieldset"><legend>Stats on Home</legend>
          <div className="repeat">
            {(stats.length ? stats : [{ value: "", prefix: "", suffix: "", label: "" }]).map((s, i, all) => {
              const upd = (k: keyof Stat, v: string) => set("stats", all.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              return (
                <div className="stat-row" key={i}>
                  <input className="input" placeholder="Prefix" value={s.prefix} onChange={(e) => upd("prefix", e.target.value)} />
                  <input className="input" placeholder="Value" inputMode="numeric" value={String(s.value)} onChange={(e) => upd("value", e.target.value)} />
                  <input className="input" placeholder="Suffix" value={s.suffix} onChange={(e) => upd("suffix", e.target.value)} />
                  <input className="input" placeholder="years shipping" value={s.label} onChange={(e) => upd("label", e.target.value)} />
                  <button className="icon-btn" aria-label="Remove stat" onClick={() => set("stats", all.filter((_, j) => j !== i))}><Icon name="x" /></button>
                </div>
              );
            })}
            <button className="add-row" onClick={() => set("stats", [...stats, { value: "", prefix: "", suffix: "", label: "" }])}><Icon name="plus" /> Add stat</button>
          </div>
        </fieldset>

        <FieldGroups groups={GROUPS.slice(3)} values={values} set={set} folder="profile" />
      </div>
    </>
  );
}
