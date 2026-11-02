"use client";

// Form controls for the section editors. Values live in one plain object owned by the parent; every control
// reads values[k] and calls set(k, next).
import { useRef, useState, type KeyboardEvent } from "react";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { publicUrl } from "@/lib/storage";
import type { Field, FieldGroup } from "@/lib/sections";

export type Values = Record<string, unknown>;
export type SelectOptions = Record<string, { value: string; label: string }[]>;

export function FieldGroups({ groups, values, set, options, folder }: {
  groups: FieldGroup[]; values: Values; set: (k: string, v: unknown) => void; options?: SelectOptions; folder: string;
}) {
  return (
    <>
      {groups.map((g) => (
        <fieldset className="fieldset" key={g.group}>
          <legend>{g.group}</legend>
          <div className="fields">
            {g.fields.map((f) => <FieldControl key={f.k} f={f} value={values[f.k]} set={(v) => set(f.k, v)} options={options?.[f.k]} folder={folder} />)}
          </div>
        </fieldset>
      ))}
    </>
  );
}

export function FieldControl({ f, value, set, options, folder }: {
  f: Field; value: unknown; set: (v: unknown) => void; options?: { value: string; label: string }[]; folder: string;
}) {
  const id = `f_${f.k}`;
  const wrap = (inner: React.ReactNode) => (
    <div className={`field ${f.full ? "full" : ""}`}>
      <label htmlFor={id}>{f.label}{f.required && " *"}</label>
      {inner}
      {f.hint && <span className="hint">{f.hint}</span>}
    </div>
  );
  const s = typeof value === "string" ? value : value == null ? "" : String(value);

  switch (f.type) {
    case "textarea":
      return wrap(<textarea id={id} value={s} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />);
    case "markdown":
      return wrap(<Markdown id={id} value={s} set={set} />);
    case "select": {
      const opts = options ?? (f.opts ?? []).map((o) => ({ value: o, label: o }));
      return wrap(
        <select id={id} value={s} onChange={(e) => set(e.target.value)}>
          {options && <option value="">None</option>}
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>,
      );
    }
    case "tags":
      return wrap(<Tags id={id} value={Array.isArray(value) ? (value as string[]) : []} set={set} />);
    case "lines":
      return wrap(<Lines value={Array.isArray(value) ? (value as string[]) : []} set={set} />);
    case "links":
      return wrap(<Links value={Array.isArray(value) ? (value as { label: string; url: string }[]) : []} set={set} />);
    case "media":
      return wrap(<ProjectMedia value={Array.isArray(value) ? value as { kind: "image" | "video"; path: string; label: string }[] : []} set={set} folder={folder} />);
    case "toggle":
      return (
        <div className={`field ${f.full ? "full" : ""}`} style={{ justifyContent: "flex-end" }}>
          <label className="toggle"><input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} /> {f.label}</label>
        </div>
      );
    case "image":
      return wrap(<Upload value={s} set={set} folder={folder} accept={f.hint?.includes("PDF") ? "image/*,application/pdf" : "image/*"} />);
    case "date":
      return wrap(<input id={id} type="date" value={s} onChange={(e) => set(e.target.value)} />);
    case "number":
      return wrap(<input id={id} type="number" value={s} onChange={(e) => set(e.target.value)} />);
    case "status":
      return wrap(
        <div className="seg" role="radiogroup" aria-label={f.label}>
          {["published", "draft", "hidden"].map((o) => (
            <label key={o}><input type="radio" name={id} checked={(s || "draft") === o} onChange={() => set(o)} /><span>{o[0].toUpperCase() + o.slice(1)}</span></label>
          ))}
        </div>,
      );
    default:
      return wrap(<input id={id} value={s} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />);
  }
}

export function Tags({ id, value, set }: { id?: string; value: string[]; set: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(",").map((t) => t.trim()).filter((t) => t && !value.includes(t));
    if (parts.length) set([...value, ...parts]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !draft && value.length) set(value.slice(0, -1));
  };
  return (
    <div className="tags">
      {value.map((t) => (
        <span key={t}>{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => set(value.filter((x) => x !== t))}><Icon name="x" /></button></span>
      ))}
      <input id={id} value={draft} placeholder="Add and press Enter" onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} />
    </div>
  );
}

export function Lines({ value, set, placeholder }: { value: string[]; set: (v: string[]) => void; placeholder?: string }) {
  const rows = value.length ? value : [""];
  const update = (i: number, v: string) => set(rows.map((r, j) => (j === i ? v : r)));
  return (
    <div className="repeat">
      {rows.map((r, i) => (
        <div className="repeat-row" key={i}>
          <input className="input" value={r} placeholder={placeholder} onChange={(e) => update(i, e.target.value)} />
          <button type="button" className="icon-btn" aria-label="Remove line" onClick={() => set(rows.filter((_, j) => j !== i))}><Icon name="x" /></button>
        </div>
      ))}
      <button type="button" className="add-row" onClick={() => set([...rows, ""])}><Icon name="plus" /> Add line</button>
    </div>
  );
}

export function Links({ value, set }: { value: { label: string; url: string }[]; set: (v: { label: string; url: string }[]) => void }) {
  const rows = value.length ? value : [{ label: "", url: "" }];
  const update = (i: number, k: "label" | "url", v: string) => set(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="repeat">
      {rows.map((r, i) => (
        <div className="repeat-row" key={i}>
          <input className="input" style={{ maxWidth: 150 }} placeholder="Label" value={r.label} onChange={(e) => update(i, "label", e.target.value)} />
          <input className="input" placeholder="https://…" value={r.url} onChange={(e) => update(i, "url", e.target.value)} />
          <button type="button" className="icon-btn" aria-label="Remove link" onClick={() => set(rows.filter((_, j) => j !== i))}><Icon name="x" /></button>
        </div>
      ))}
      <button type="button" className="add-row" onClick={() => set([...rows, { label: "", url: "" }])}><Icon name="plus" /> Add link</button>
    </div>
  );
}

function Markdown({ id, value, set }: { id: string; value: string; set: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrapSel = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    set(value.slice(0, a) + before + value.slice(a, b) + after + value.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, b + before.length); });
  };
  return (
    <>
      <div className="rte-bar">
        <button type="button" onClick={() => wrapSel("\n## ", "\n")}>H2</button>
        <button type="button" onClick={() => wrapSel("**")}>B</button>
        <button type="button" onClick={() => wrapSel("_")}><i>I</i></button>
        <button type="button" onClick={() => wrapSel("\n> ", "\n")}>“ ”</button>
        <button type="button" onClick={() => wrapSel("\n```\n", "\n```\n")}>&lt;/&gt;</button>
        <button type="button" onClick={() => wrapSel("[", "](https://)")}><Icon name="link" /></button>
      </div>
      <textarea id={id} ref={ref} value={value} onChange={(e) => set(e.target.value)} />
    </>
  );
}

// Uploads straight from the browser to the public "portfolio" bucket with the admin's session (RLS-checked),
// then stores only the object path in the row.
export function ProjectMedia({ value, set, folder }: {
  value: { kind: "image" | "video"; path: string; label: string }[];
  set: (value: unknown) => void; folder: string;
}) {
  const update = (index: number, patch: Partial<(typeof value)[number]>) => set(value.map((item, i) => i === index ? { ...item, ...patch } : item));
  const move = (index: number, direction: number) => {
    const rows = [...value];
    [rows[index], rows[index + direction]] = [rows[index + direction], rows[index]];
    set(rows);
  };
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {value.map((item, index) => (
        <div key={index} style={{ display: "grid", gap: 10, border: "1px solid var(--line)", padding: 12, borderRadius: 12 }}>
          <input className="input" aria-label={`Media ${index + 1} description`} value={item.label} placeholder="Description" onChange={(e) => update(index, { label: e.target.value })} />
          {item.path && (item.kind === "video"
            ? <video controls preload="none" src={publicUrl(item.path)} aria-label={item.label || "Project demonstration"} style={{ width: "100%", maxHeight: 320 }} />
            : <img src={publicUrl(item.path)} alt={item.label} loading="lazy" style={{ width: "100%", maxHeight: 320, objectFit: "contain" }} />)}
          <Upload value={item.path} set={(path) => update(index, { path: path || "" })} folder={folder} accept={item.kind === "video" ? "video/mp4,video/webm" : "image/*"} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn sm ghost" disabled={index === 0} onClick={() => move(index, -1)}>Move up</button>
            <button type="button" className="btn sm ghost" disabled={index === value.length - 1} onClick={() => move(index, 1)}>Move down</button>
            <button type="button" className="btn sm ghost" onClick={() => set(value.filter((_, i) => i !== index))}>Remove from gallery</button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn sm ghost" onClick={() => set([...value, { kind: "image", path: "", label: "" }])}>Add screenshot</button>
        <button type="button" className="btn sm ghost" onClick={() => set([...value, { kind: "video", path: "", label: "" }])}>Add video</button>
      </div>
    </div>
  );
}

export function Upload({ value, set, folder, accept = "image/*" }: { value: string; set: (v: string | null) => void; folder: string; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErr("");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("portfolio").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setBusy(false);
    if (error) setErr(error.message);
    else set(path);
  };
  const isPdf = value.toLowerCase().endsWith(".pdf");
  const isVideo = /\.(mp4|webm)(?:[?#]|$)/i.test(value);
  return (
    <>
      <div className={`drop ${value ? "has-file" : ""} ${busy ? "busy" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
        {value ? (
          <>
            {isPdf ? <Icon name="text" /> : isVideo ? <Icon name="video" /> : <span className="preview" style={{ backgroundImage: `url("${publicUrl(value)}")` }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{busy ? "Uploading…" : "Replace file"}</b>
              <div className="faint mono" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
            </div>
            <button type="button" className="btn sm ghost" style={{ position: "relative", zIndex: 1 }} onClick={() => set(null)}>Remove</button>
          </>
        ) : (
          <>
            <Icon name="upload" />
            <b>{busy ? "Uploading…" : "Drop a file or browse"}</b>
            <span className="faint">Stored in Supabase Storage</span>
          </>
        )}
        <input type="file" accept={accept} aria-label="Choose file" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {err && <span className="err">{err}</span>}
    </>
  );
}
