"use client";

// Generic list page for every LIST_SECTIONS entry: status tabs, search, drag-to-reorder and a slide-in editor.
// Gallery renders as a photo grid and Skills as group cards; everything else is a table.
import { useEffect, useMemo, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { Drawer, Status, useToast } from "@/components/ui";
import { FieldGroups, type SelectOptions, type Values } from "@/components/Fields";
import { LIST_SECTIONS, allFields, type Column } from "@/lib/sections";
import { publicUrl } from "@/lib/storage";
import { deleteRow, reorderRows, saveRow } from "@/app/actions";

type Row = Values & { id: string; status: string };
const TABS = ["all", "published", "draft", "hidden"] as const;

function blank(section: string): Values {
  const v: Values = { status: "draft" };
  for (const f of allFields(LIST_SECTIONS[section])) {
    if (f.k in v) continue;
    v[f.k] = f.type === "tags" || f.type === "lines" || f.type === "links" ? [] : f.type === "toggle" ? false
      : f.type === "select" && f.opts ? f.opts[0] : "";
  }
  return v;
}

function Cell({ c, r }: { c: Column; r: Row }) {
  const s = (k: string) => (r[k] == null ? "" : String(r[k]));
  switch (c.kind) {
    case "main": {
      const sub = (c.sub ?? []).map(s).filter(Boolean).join(" · ");
      return (
        <div className="row-flex">
          {c.thumb && <div className="thumb" style={r[c.thumb] ? { backgroundImage: `url("${publicUrl(s(c.thumb))}")` } : undefined} />}
          <div className="cell-main" style={{ minWidth: 0 }}>
            <b className={c.mono ? "mono" : ""} style={c.mono ? { fontSize: 13 } : undefined}>{s(c.title) || <span className="faint">Untitled</span>}</b>
            {sub && <small style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>{sub}</small>}
          </div>
        </div>
      );
    }
    case "range": return <span className="muted">{s(c.from) || "—"} – {s(c.to) || "Present"}</span>;
    case "chip": return s(c.key) ? <span className="chip plain">{s(c.key)}</span> : <span className="faint">—</span>;
    case "featured": return r[c.key] ? <span className="chip label plain">★ Featured</span> : <span className="faint">—</span>;
    case "status": return <Status value={r.status} />;
    default: return <span className="muted">{s(c.key) || "—"}</span>;
  }
}

export default function SectionList({ section, rows: initial, options }: { section: string; rows: Row[]; options?: SelectOptions }) {
  const def = LIST_SECTIONS[section];
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; values: Values } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => setRows(initial), [initial]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (tab === "all" || r.status === tab) &&
      (!needle || JSON.stringify(r).toLowerCase().includes(needle)));
  }, [rows, tab, q]);
  const canDrag = tab === "all" && !q;

  const open = (r: Row | null) => { setError(""); setEditing(r ? { id: r.id, values: { ...r } } : { id: null, values: blank(section) }); };
  const close = () => setEditing(null);

  const save = (statusOverride?: string) => {
    if (!editing) return;
    const values = statusOverride ? { ...editing.values, status: statusOverride } : editing.values;
    start(async () => {
      const res = await saveRow(section, editing.id, values);
      if (!res.ok) return setError(res.error);
      toast(values.status === "published" ? "Published to the live site" : "Saved");
      close();
    });
  };
  const remove = () => {
    if (!editing?.id || !confirm(`Delete this ${def.singular}? This cannot be undone.`)) return;
    const id = editing.id;
    start(async () => {
      const res = await deleteRow(section, id);
      if (!res.ok) return setError(res.error);
      toast("Deleted");
      close();
    });
  };
  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = [...rows];
    const from = next.findIndex((r) => r.id === dragId);
    const to = next.findIndex((r) => r.id === targetId);
    next.splice(to, 0, next.splice(from, 1)[0]);
    setRows(next);
    setDragId(null);
    setOverId(null);
    start(async () => {
      const res = await reorderRows(section, next.map((r) => r.id));
      toast(res.ok ? "Order saved" : res.error);
    });
  };
  const dragProps = (r: Row) => canDrag ? {
    draggable: true,
    onDragStart: () => setDragId(r.id),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOverId(r.id); },
    onDragEnd: () => { setDragId(null); setOverId(null); },
    onDrop: () => drop(r.id),
  } : {};

  const counts = (t: string) => (t === "all" ? rows.length : rows.filter((r) => r.status === t).length);
  const title = editing ? String(editing.values[def.titleKey] || "") : "";

  return (
    <>
      <div className="page-head">
        <div><div className="kicker">Portfolio</div><h1>{def.label}</h1><p>{def.blurb}</p></div>
        <div className="actions"><button className="btn primary" onClick={() => open(null)}><Icon name="plus" /> Add {def.singular}</button></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t[0].toUpperCase() + t.slice(1)} <span className="faint">{counts(t)}</span>
              </button>
            ))}
          </div>
          <label className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${def.label.toLowerCase()}…`} /></label>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <Icon name={def.icon} />
            <h2 style={{ fontSize: 18, margin: "10px 0 6px" }}>No {def.label.toLowerCase()} yet</h2>
            <p>Add the first {def.singular}; it stays a draft until you publish it.</p>
            <button className="btn primary" style={{ marginTop: 14 }} onClick={() => open(null)}><Icon name="plus" /> Add {def.singular}</button>
          </div>
        ) : section === "gallery" ? (
          <div className="grid gallery">
            <button className="photo upload" onClick={() => open(null)}><Icon name="upload" /><b>Add a photo</b><span className="faint" style={{ fontSize: 12 }}>Opens the uploader</span></button>
            {shown.map((r, i) => (
              <div key={r.id} className={`photo ${overId === r.id ? "drop-target" : ""}`} onClick={() => open(r)} {...dragProps(r)}>
                <div className="img" style={{ backgroundImage: `url("${publicUrl(String(r.path))}")` }} />
                <span className="badge"><Status value={r.status} /></span>
                <div className="meta"><b>{String(r.caption || "Untitled")}</b><small>{i < 6 ? "Café photo wall · " : ""}{String(r.placement)}</small></div>
              </div>
            ))}
          </div>
        ) : section === "skills" ? (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", padding: 16 }}>
            {shown.map((r) => (
              <div key={r.id} className={`card ${overId === r.id ? "drop-target" : ""}`} style={{ cursor: "pointer" }} onClick={() => open(r)} {...dragProps(r)}>
                <div className="card-head"><span className="handle"><Icon name="drag" /></span><h2>{String(r.title)}</h2><span style={{ marginLeft: "auto" }}><Status value={r.status} /></span></div>
                <div className="card-pad">
                  <div className="tags" style={{ background: "none", borderStyle: "dashed" }}>
                    {(r.skills as string[]).length ? (r.skills as string[]).map((s) => <span key={s} style={{ paddingRight: 10 }}>{s}</span>) : <span className="faint" style={{ background: "none" }}>No skills yet</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table>
            <thead><tr><th style={{ width: 28 }} />{def.columns.map((c) => <th key={c.label} className={"hideSm" in c && c.hideSm ? "hide-sm" : ""}>{c.label}</th>)}</tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => open(r)} className={`${dragId === r.id ? "dragging" : ""} ${overId === r.id ? "drop-target" : ""}`} {...dragProps(r)}>
                  <td className="handle" title={canDrag ? "Drag to reorder" : "Clear filters to reorder"}><Icon name="drag" /></td>
                  {def.columns.map((c) => <td key={c.label} className={"hideSm" in c && c.hideSm ? "hide-sm" : ""}><Cell c={c} r={r} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 0 && (
          <div className="table-foot"><Icon name="info" /> Drag to set the order on the public site. Drafts and hidden entries never leave the admin.</div>
        )}
      </div>

      <Drawer open={!!editing} onClose={close} kicker={def.label} title={editing?.id ? title || "Untitled" : `New ${def.singular}`}
        footer={<>
          {editing?.id && <button className="btn ghost danger sm" onClick={remove} disabled={pending}><Icon name="trash" /> Delete</button>}
          {error && <span className="err">{error}</span>}
          <span className="spacer" />
          <button className="btn sm" onClick={() => save()} disabled={pending}>Save</button>
          <button className="btn primary sm" onClick={() => save("published")} disabled={pending}><Icon name="check" /> Publish</button>
        </>}>
        {editing && (
          <FieldGroups groups={def.groups} values={editing.values} options={options} folder={section}
            set={(k, v) => setEditing((e) => (e ? { ...e, values: { ...e.values, [k]: v } } : e))} />
        )}
      </Drawer>
    </>
  );
}
