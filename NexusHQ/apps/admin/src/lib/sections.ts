// One declarative description per editable list section. The list page, the editor drawer and the server-side
// write whitelist (actions.ts) all read from here, so a column only becomes editable by being listed below.
import type { TableName } from "@/lib/database.types";

export type FieldType =
  | "text" | "textarea" | "markdown" | "select" | "tags" | "lines" | "links" | "toggle" | "image" | "date" | "number" | "status" | "media";

export interface Field {
  k: string;               // column name
  label: string;
  type: FieldType;
  opts?: string[];
  full?: boolean;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}
export type FieldGroup = { group: string; fields: Field[] };

export type Column =
  | { kind: "main"; label: string; title: string; sub?: string[]; thumb?: string; mono?: boolean }
  | { kind: "text"; label: string; key: string; hideSm?: boolean }
  | { kind: "range"; label: string; from: string; to: string; hideSm?: boolean }
  | { kind: "chip"; label: string; key: string; hideSm?: boolean }
  | { kind: "featured"; label: string; key: string; hideSm?: boolean }
  | { kind: "status"; label: string };

// Every list table shares id / status / sort_order / created_at / updated_at. Queries that pick the table at
// runtime cast to one representative table so the typed client accepts those shared columns.
export type ListTable = "projects";

export interface SectionDef {
  key: string;             // route segment
  table: TableName;
  label: string;
  singular: string;
  blurb: string;
  icon: string;
  titleKey: string;        // used as drawer title and for slug generation
  slug?: boolean;          // table has a unique slug column, auto-filled from titleKey when empty
  columns: Column[];
  groups: FieldGroup[];
}

const publishing: FieldGroup = { group: "Publishing", fields: [{ k: "status", label: "Visibility", type: "status" }] };

export const LIST_SECTIONS: Record<string, SectionDef> = {
  experience: {
    key: "experience", table: "experiences", label: "Experience", singular: "role", icon: "brief", titleKey: "role", slug: true,
    blurb: "Jobs and contracts shown on the Experience timeline (and the framed photos in the café), in this order.",
    columns: [
      { kind: "main", label: "Role", title: "role", sub: ["company", "place"], thumb: "logo_path" },
      { kind: "range", label: "Dates", from: "start_label", to: "end_label", hideSm: true },
      { kind: "chip", label: "Type", key: "employment_type", hideSm: true },
      { kind: "status", label: "Status" },
    ],
    groups: [
      { group: "Role", fields: [
        { k: "role", label: "Job title", type: "text", required: true },
        { k: "company", label: "Company", type: "text" },
        { k: "logo_path", label: "Company logo", type: "image", full: true, hint: "Square PNG/SVG works best. The latest three roles appear as framed photos in the 3D café." },
        { k: "start_label", label: "Start", type: "text", hint: "e.g. Mar 2023" },
        { k: "end_label", label: "End", type: "text", hint: "Leave empty for “Present”" },
        { k: "place", label: "Location", type: "text", placeholder: "Remote" },
        { k: "employment_type", label: "Employment type", type: "select", opts: ["Full-time", "Contract", "Part-time", "Internship", "Freelance"] },
        { k: "slug", label: "URL slug", type: "text", hint: "Filled from the title when empty" },
      ] },
      { group: "Story", fields: [
        { k: "summary", label: "Summary", type: "textarea", full: true },
        { k: "highlights", label: "Highlights", type: "lines", full: true },
        { k: "skills", label: "Skills used", type: "tags", full: true },
      ] },
      publishing,
    ],
  },
  education: {
    key: "education", table: "education", label: "Education", singular: "entry", icon: "cap", titleKey: "title",
    blurb: "Degrees, courses and certifications under the Experience timeline.",
    columns: [
      { kind: "main", label: "Title", title: "title", sub: ["org"] },
      { kind: "text", label: "When", key: "when_label", hideSm: true },
      { kind: "status", label: "Status" },
    ],
    groups: [
      { group: "Details", fields: [
        { k: "title", label: "Title", type: "text", full: true, required: true },
        { k: "org", label: "Institution", type: "text" },
        { k: "when_label", label: "When", type: "text", placeholder: "2015 – 2019" },
        { k: "subjects", label: "Subjects / topics", type: "tags", full: true },
        { k: "certificate_path", label: "Certificate", type: "image", full: true, hint: "PDF or image, optional" },
      ] },
      publishing,
    ],
  },
  projects: {
    key: "projects", table: "projects", label: "Projects", singular: "project", icon: "folder", titleKey: "name", slug: true,
    blurb: "Cards on Projects (and the bookshelf in the 3D café). Each one can open a full case study.",
    columns: [
      { kind: "main", label: "Project", title: "name", sub: ["kind", "year"], thumb: "cover_path" },
      { kind: "chip", label: "Category", key: "category", hideSm: true },
      { kind: "featured", label: "Featured", key: "featured", hideSm: true },
      { kind: "status", label: "Status" },
    ],
    groups: [
      { group: "Card", fields: [
        { k: "name", label: "Name", type: "text", required: true },
        { k: "slug", label: "URL slug", type: "text", hint: "/projects/… — filled from the name when empty" },
        { k: "kind", label: "Kind", type: "text", placeholder: "SaaS, AI tool…" },
        { k: "year", label: "Year", type: "text" },
        { k: "category", label: "Category (filter)", type: "select", opts: ["web", "ai", "platform"] },
        { k: "featured", label: "Feature on Projects and Home", type: "toggle" },
        { k: "summary", label: "Card summary", type: "textarea", full: true },
        { k: "cover_path", label: "Cover image", type: "image", full: true },
        { k: "skills", label: "Stack", type: "tags", full: true },
        { k: "links", label: "Links", type: "links", full: true },
      ] },
      { group: "Screenshots and videos", fields: [
        { k: "media", label: "Project gallery", type: "media", full: true },
      ] },
      { group: "Case study", fields: [
        { k: "role", label: "Your role", type: "text" },
        { k: "timeline", label: "Timeline", type: "text" },
        { k: "team", label: "Team", type: "text" },
        { k: "problem", label: "The problem", type: "textarea", full: true },
        { k: "built", label: "What I built", type: "textarea", full: true },
        { k: "decisions", label: "Key decisions", type: "lines", full: true },
        { k: "results", label: "Results", type: "textarea", full: true },
        { k: "quote_testimonial_id", label: "Client quote", type: "select", full: true, hint: "Pick from approved testimonials" },
      ] },
      publishing,
    ],
  },
  opensource: {
    key: "opensource", table: "open_source", label: "Open source", singular: "repo", icon: "git", titleKey: "name",
    blurb: "Libraries you maintain or contribute to (the cookie jar in the café).",
    columns: [
      { kind: "main", label: "Repository", title: "name", sub: ["relation"], mono: true },
      { kind: "chip", label: "Badge", key: "badge", hideSm: true },
      { kind: "status", label: "Status" },
    ],
    groups: [
      { group: "Repository", fields: [
        { k: "name", label: "Name", type: "text", required: true },
        { k: "relation", label: "Your relation", type: "select", opts: ["Maintainer", "Contributor", "Creator"] },
        { k: "url", label: "GitHub URL", type: "text", full: true },
        { k: "badge", label: "Badge", type: "text", hint: "Stars, PR count…" },
        { k: "summary", label: "Summary", type: "textarea", full: true },
      ] },
      publishing,
    ],
  },
  articles: {
    key: "articles", table: "articles", label: "Articles", singular: "article", icon: "pen", titleKey: "title", slug: true,
    blurb: "Writing on the Articles page (and the newspaper in the café).",
    columns: [
      { kind: "main", label: "Title", title: "title", sub: ["summary"] },
      { kind: "text", label: "Date", key: "published_on", hideSm: true },
      { kind: "status", label: "Status" },
    ],
    groups: [
      { group: "Article", fields: [
        { k: "title", label: "Title", type: "text", full: true, required: true },
        { k: "slug", label: "URL slug", type: "text", hint: "Filled from the title when empty" },
        { k: "published_on", label: "Publish date", type: "date" },
        { k: "summary", label: "Summary", type: "textarea", full: true },
        { k: "cover_path", label: "Cover image", type: "image", full: true },
        { k: "body_md", label: "Body (Markdown)", type: "markdown", full: true, hint: "Reading time is calculated on save" },
      ] },
      publishing,
    ],
  },
  hobbies: {
    key: "hobbies", table: "hobbies", label: "Hobbies", singular: "hobby", icon: "heart", titleKey: "title",
    blurb: "Small “outside of work” cards on About (the DJ booth in the café).",
    columns: [
      { kind: "main", label: "Hobby", title: "title", sub: ["body"], thumb: "photo_path" },
      { kind: "status", label: "Status" },
    ],
    groups: [
      { group: "Card", fields: [
        { k: "title", label: "Title", type: "text", full: true, required: true },
        { k: "body", label: "Short text", type: "textarea", full: true, hint: "One or two lines for the card." },
        { k: "details", label: "Long text", type: "markdown", full: true, hint: "The full story, shown when the hobby is opened in the 3D café. Blank lines split paragraphs; ## for a heading." },
        { k: "photo_path", label: "Photo (optional)", type: "image", full: true },
      ] },
      publishing,
    ],
  },
  skills: {
    key: "skills", table: "skill_groups", label: "Skills", singular: "group", icon: "spark", titleKey: "title",
    blurb: "Grouped skill chips on the Skills page and the café menu board. Drag to reorder groups.",
    columns: [{ kind: "main", label: "Group", title: "title" }, { kind: "status", label: "Status" }],
    groups: [
      { group: "Group", fields: [
        { k: "title", label: "Group name", type: "text", full: true, required: true },
        { k: "skills", label: "Skills", type: "tags", full: true },
      ] },
      publishing,
    ],
  },
  gallery: {
    key: "gallery", table: "gallery_photos", label: "Gallery", singular: "photo", icon: "image", titleKey: "caption",
    blurb: "Photos for the About page gallery; the first six hang on the café photo wall.",
    columns: [{ kind: "main", label: "Photo", title: "caption", thumb: "path" }, { kind: "status", label: "Status" }],
    groups: [
      { group: "Details", fields: [
        { k: "path", label: "Photo", type: "image", full: true, required: true },
        { k: "caption", label: "Caption", type: "text", full: true },
        { k: "alt", label: "Alt text", type: "text", full: true, hint: "Describe the photo for screen readers" },
        { k: "placement", label: "Show in", type: "select", opts: ["About gallery", "About hero strip", "Hobby card"] },
      ] },
      publishing,
    ],
  },
};

export function allFields(def: SectionDef): Field[] {
  return def.groups.flatMap((g) => g.fields);
}

// Sidebar / dashboard structure (route segment → label). Specialised pages (profile, testimonials, café…) are
// listed here too even though they are not generic list sections.
export const NAV = [
  { single: "", label: "Dashboard", icon: "home" },
  {
    group: "Portfolio", icon: "folder", open: true,
    items: [
      ["profile", "Profile & About"], ["experience", "Experience"], ["education", "Education"], ["projects", "Projects"],
      ["skills", "Skills"], ["opensource", "Open source"], ["articles", "Articles"], ["gallery", "Gallery"],
      ["hobbies", "Hobbies"], ["testimonials", "Testimonials"], ["cafe", "3D café"],
    ],
  },
  { group: "Inbox", icon: "mail", open: false, items: [["messages", "Contact messages"]] },
  { group: "Upwork cockpit", icon: "bolt", open: false, items: [["jobs", "Job radar"], ["upwork", "Upwork inbox"], ["resume", "Resume"], ["agents", "AI agents"]] },
  { group: "Settings", icon: "gear", open: false, items: [["users", "Users & roles"], ["site", "Site settings"]] },
] as const;

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
