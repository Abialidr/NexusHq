// Pulling JSON out of model output and checking it against the (small, flat) JSON schemas the agents use.
// Covers object/array/string/number/integer/boolean, required and enum — enough for our schemas, not a full
// JSON Schema validator.

export type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  required?: readonly string[];
  items?: Schema;
  enum?: readonly unknown[];
  additionalProperties?: boolean;
};

export function extractJson(text: string): unknown {
  const t = text.trim();
  try { return JSON.parse(t); } catch {}
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) try { return JSON.parse(fenced[1]); } catch {}
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error(`No JSON in model output: ${t.slice(0, 200)}`);
}

export function validate(schema: Schema, value: unknown, at = "$"): string[] {
  const errs: string[] = [];
  const t = schema.type;
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: not one of ${schema.enum.join(", ")}`);
  if (t === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [`${at}: expected object`];
    const obj = value as Record<string, unknown>;
    for (const k of schema.required ?? []) if (!(k in obj)) errs.push(`${at}.${k}: missing`);
    for (const [k, s] of Object.entries(schema.properties ?? {})) if (k in obj) errs.push(...validate(s, obj[k], `${at}.${k}`));
  } else if (t === "array") {
    if (!Array.isArray(value)) return [`${at}: expected array`];
    if (schema.items) value.forEach((v, i) => errs.push(...validate(schema.items!, v, `${at}[${i}]`)));
  } else if (t === "integer") {
    if (!Number.isInteger(value)) errs.push(`${at}: expected integer`);
  } else if (t && typeof value !== t) {
    errs.push(`${at}: expected ${t}`);
  }
  return errs;
}

export function parseAndValidate<T>(schema: Schema, raw: unknown): T {
  const value = typeof raw === "string" ? extractJson(raw) : raw;
  const errs = validate(schema, value);
  if (errs.length) throw new Error(`Output didn't match schema: ${errs.slice(0, 3).join("; ")}`);
  return value as T;
}
