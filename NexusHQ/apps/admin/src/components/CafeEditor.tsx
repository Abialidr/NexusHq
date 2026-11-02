"use client";

// 3D café-only content: scene signs, the panel copy each clickable object opens, and 3D model credits.
import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { Drawer, useToast } from "@/components/ui";
import { FieldGroups, type Values } from "@/components/Fields";
import type { Row } from "@/lib/database.types";
import { deleteCredit, saveCafePanel, saveCredit, saveSettings } from "@/app/actions";

const SOURCE: Record<string, string> = {
  about: "Profile & About", skills: "Skills", projects: "Projects", experience: "Experience", articles: "Articles",
  hobbies: "Hobbies", opensource: "Open source", gallery: "Gallery (first 6)", contact: "Profile · socials", credits: "Model credits below",
};

export default function CafeEditor({ settings, panels, credits }: {
  settings: Row<"site_settings">; panels: Row<"cafe_panels">[]; credits: Row<"model_credits">[];
}) {
  const toast = useToast();
  const [signs, setSigns] = useState<Values>(settings);
  const [panel, setPanel] = useState<Values | null>(null);
  const [credit, setCredit] = useState<Values | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) => start(async () => {
    setError("");
    const res = await fn();
    if (res.ok) { toast(msg); after?.(); } else setError(res.error ?? "Something went wrong");
  });

  return (
    <>
      <div className="page-head">
        <div><div className="kicker">Portfolio</div><h1>3D café</h1><p>Words that only exist in the 3D café: signs, the panel each object opens, and credits for the 3D model artists.</p></div>
        <div className="actions">
          {error && !panel && !credit && <span className="err">{error}</span>}
          <button className="btn primary" disabled={pending} onClick={() => run(() => saveSettings(signs), "Café signs published")}><Icon name="check" /> Publish signs</button>
        </div>
      </div>
      <div className="notice"><Icon name="info" /><div>The café reads the same records as the 2D site, so lists are edited in their own sections. This page only holds what is unique to the 3D scene. <span className="muted">The café is hidden on phones and tablets.</span></div></div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <FieldGroups folder="cafe" values={signs} set={(k, v) => setSigns((s) => ({ ...s, [k]: v }))} groups={[{ group: "Signs in the scene", fields: [
          { k: "cafe_neon", label: "Main neon sign", type: "text" },
          { k: "cafe_neon_sub", label: "Sign subline", type: "text", hint: "Name and the year you started, e.g. “Abiali · EST. 2019”" },
          { k: "cafe_window_neon", label: "Window neon", type: "text" },
          { k: "cafe_door_neon", label: "Door neon", type: "text" },
          { k: "cafe_what_i_do", label: "Barista panel: “What I do”", type: "text", full: true },
        ] }]} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>Object panels</h2><span className="faint hide-sm" style={{ fontSize: 13, marginLeft: "auto" }}>Click a row to edit its heading and intro</span></div>
        <table>
          <thead><tr><th>Object</th><th>Kicker</th><th>Title</th><th className="hide-sm">List comes from</th></tr></thead>
          <tbody>{panels.map((p) => (
            <tr key={p.zone} onClick={() => { setError(""); setPanel({ ...p }); }}>
              <td><b>{p.object_name}</b></td><td className="muted">{p.kicker}</td><td>{p.title || <span className="faint">Uses your name</span>}</td>
              <td className="hide-sm"><span className="chip plain">{SOURCE[p.zone] ?? p.zone}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><h2>3D model credits</h2><button className="btn sm" onClick={() => { setError(""); setCredit({ model: "", artist: "", license: "CC BY 4.0", source_url: "" }); }}><Icon name="plus" /> Add credit</button></div>
        {credits.length ? (
          <table>
            <thead><tr><th>Model</th><th>Artist</th><th className="hide-sm">Licence</th></tr></thead>
            <tbody>{credits.map((c) => (
              <tr key={c.id} onClick={() => { setError(""); setCredit({ ...c }); }}>
                <td><b>{c.model}</b></td><td className="muted">{c.artist}</td><td className="hide-sm"><span className="chip plain">{c.license}</span></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className="empty" style={{ padding: 28 }}>No credits yet. Add one per Sketchfab model used in the scene.</div>}
        <div className="table-foot"><Icon name="info" /> CC BY requires attribution — credits show on the café notice board while the model is in the scene.</div>
      </div>

      <Drawer open={!!panel} onClose={() => setPanel(null)} kicker={`3D café · ${panel?.object_name ?? ""}`} title="Panel text"
        footer={<>{error && <span className="err">{error}</span>}<span className="spacer" />
          <button className="btn primary sm" disabled={pending} onClick={() => panel && run(() => saveCafePanel(String(panel.zone), panel), "Panel saved", () => setPanel(null))}>Save</button></>}>
        {panel && (
          <>
            <FieldGroups folder="cafe" values={panel} set={(k, v) => setPanel((p) => (p ? { ...p, [k]: v } : p))} groups={[{ group: "Panel", fields: [
              { k: "kicker", label: "Kicker", type: "text" },
              { k: "title", label: "Title", type: "text", hint: panel.zone === "about" ? "Empty = “Hey, I am <your name>”" : undefined },
              { k: "body", label: "Intro line", type: "textarea", full: true },
              { k: "menu_label", label: "Label in the café menu", type: "text" },
            ] }]} />
            <div className="notice" style={{ margin: 0 }}><Icon name="info" /><div>The list in this panel comes from <b>{SOURCE[String(panel.zone)]}</b>.</div></div>
          </>
        )}
      </Drawer>

      <Drawer open={!!credit} onClose={() => setCredit(null)} kicker="3D café" title={credit?.id ? String(credit.model) : "New credit"}
        footer={<>
          {credit?.id ? <button className="btn ghost danger sm" disabled={pending} onClick={() => confirm("Delete this credit?") && run(() => deleteCredit(String(credit.id)), "Credit deleted", () => setCredit(null))}><Icon name="trash" /> Delete</button> : null}
          {error && <span className="err">{error}</span>}<span className="spacer" />
          <button className="btn primary sm" disabled={pending} onClick={() => credit && run(() => saveCredit(credit.id ? String(credit.id) : null, credit), "Credit saved", () => setCredit(null))}>Save</button></>}>
        {credit && (
          <FieldGroups folder="cafe" values={credit} set={(k, v) => setCredit((c) => (c ? { ...c, [k]: v } : c))} groups={[{ group: "Credit", fields: [
            { k: "model", label: "Model", type: "text", required: true },
            { k: "artist", label: "Artist", type: "text", required: true },
            { k: "license", label: "Licence", type: "select", opts: ["CC BY 4.0", "CC0", "CC BY-SA 4.0", "Own work"] },
            { k: "source_url", label: "Source URL", type: "text", full: true, placeholder: "https://sketchfab.com/…" },
          ] }]} />
        )}
      </Drawer>
    </>
  );
}
