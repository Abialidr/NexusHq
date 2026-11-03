import "server-only";
// The first-run setup wizard's server side (used by app/setup/actions.ts). It connects a Supabase project:
// checks the keys, installs the database migrations, creates the admin and worker users, stores the worker's
// password on this machine, and writes nexushq.config.json.
//
// Credentials and where they go:
//   publishable key  → nexushq.config.json (public anyway; ships to every browser)
//   secret key       → used for this request only (create users), never stored
//   access token     → used for this request only (run migrations via the Management API, because the secret key
//                      cannot run SQL), never stored; only asked for when the database still needs migrations
//   worker password  → generated here, set on the worker user, stored DPAPI-encrypted in apps/worker/.secrets
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { readConfig, repoRoot, writeConfig } from "@nexushq/shared/config";
import { setLocalSecret } from "@nexushq/shared/local-secrets";

export const DEFAULT_WORKER_EMAIL = "worker@nexushq.local";

export interface Connection {
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  accessToken?: string;
}

export interface Migration {
  version: string;
  name: string;
}

export interface DbState {
  // ready: nothing to install · pending: migrations to run (token given) · needs_token: can't tell or can't install
  // without an access token · manual: not a supabase.co project, run migrations yourself
  state: "ready" | "pending" | "needs_token" | "manual";
  pending: Migration[];
  detail: string;
}

export interface SetupCheck {
  projectRef: string | null;
  db: DbState;
  admins: string[];
  workerExists: boolean;
}

export interface SetupInput extends Connection {
  adminEmail?: string;
  adminPassword?: string;
  workerEmail: string;
}

export interface SetupStep {
  label: string;
  status: "done" | "skipped" | "error";
  detail: string;
}

// "https://<20-char ref>.supabase.co" → ref. Null for self-hosted or custom domains.
export function projectRef(url: string): string | null {
  return /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url.trim())?.[1] ?? null;
}

export function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function adminClient(c: Connection): SupabaseClient {
  return createClient(normalizeUrl(c.supabaseUrl), c.secretKey.trim(), { auth: { persistSession: false, autoRefreshToken: false } });
}

// ---------------------------------------------------------------------------------------------------------
// keys
// ---------------------------------------------------------------------------------------------------------

async function checkKeys(c: Connection) {
  const url = normalizeUrl(c.supabaseUrl);
  if (!/^https?:\/\/[^\s/]+$/.test(url)) throw new Error("The project URL should look like https://<project-ref>.supabase.co");
  if (!c.publishableKey.trim()) throw new Error("Enter the publishable key.");
  if (!c.secretKey.trim()) throw new Error("Enter the secret key.");
  let res: Response;
  try {
    res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: c.publishableKey.trim() }, cache: "no-store" });
  } catch {
    throw new Error(`Couldn't reach ${url}. Check the project URL and your internet connection.`);
  }
  if (!res.ok) throw new Error(`The publishable key was rejected (HTTP ${res.status}).`);
  const { error } = await adminClient(c).auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error(`The secret key was rejected: ${error.message}`);
}

// ---------------------------------------------------------------------------------------------------------
// migrations
// ---------------------------------------------------------------------------------------------------------

export function migrationFiles(): (Migration & { file: string })[] {
  const dir = path.join(repoRoot(), "supabase", "migrations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(f))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ version: m[1], name: m[2], file: path.join(dir, m[0]) }))
    .sort((a, b) => a.version.localeCompare(b.version));
}

async function managementQuery(ref: string, token: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token.trim()}`, "content-type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  const body = await res.text();
  if (res.status === 401 || res.status === 403) throw new Error("The access token was rejected, or it has no access to this project.");
  if (!res.ok) throw new Error(`Supabase Management API ${res.status}: ${body.slice(0, 600)}`);
  return JSON.parse(body) as Record<string, unknown>[];
}

// A quick check that needs no access token: the newest schema (agent_settings) is reachable with the secret key.
async function schemaLooksInstalled(c: Connection): Promise<boolean> {
  const { error } = await adminClient(c).from("agent_settings").select("agent").limit(1); // GET: errors need a body
  if (!error) return true;
  if (error.code === "PGRST205" || error.code === "42P01") return false;
  throw new Error(`Checking the database failed: ${error.message}`);
}

// What the newest migrations leave behind: the upwork_actions table (20261026150000_upwork_inbox) and no 'judge'
// settings row (20261026140000_drop_judge_row). Update this probe whenever a migration is added, so a re-run without
// an access token still notices it.
async function newestSchemaInstalled(c: Connection): Promise<boolean> {
  const db = adminClient(c);
  // A normal GET, not head: a HEAD error response has no body, so the error code and message would be empty.
  const { error } = await db.from("search_scratchpad").select("day").limit(1);
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") return false;
    throw new Error(`Checking the database failed: ${error.message}`);
  }
  const { data: judge } = await db.from("agent_settings").select("agent").eq("agent", "judge").maybeSingle();
  return !judge;
}

// Versions and names already recorded. Migrations applied through the Supabase MCP / dashboard get their own
// timestamp as version but keep the name, so a file counts as applied when either matches.
async function appliedMigrations(ref: string, token: string): Promise<{ versions: Set<string>; names: Set<string> } | null> {
  const [{ has }] = (await managementQuery(ref, token, "select to_regclass('supabase_migrations.schema_migrations') is not null as has")) as { has: boolean }[];
  if (!has) return null;
  const rows = await managementQuery(ref, token, "select version, name from supabase_migrations.schema_migrations");
  return { versions: new Set(rows.map((r) => String(r.version))), names: new Set(rows.map((r) => String(r.name ?? ""))) };
}

async function dbState(c: Connection, ref: string | null): Promise<DbState> {
  const files = migrationFiles();
  const installed = await schemaLooksInstalled(c);
  if (!ref) {
    return installed
      ? { state: "ready", pending: [], detail: "The database already has the NexusHQ tables." }
      : { state: "manual", pending: files, detail: "This isn't a supabase.co project, so run the files in supabase/migrations yourself, then check again." };
  }
  if (!c.accessToken?.trim()) {
    if (!installed) return { state: "needs_token", pending: files, detail: "The database is empty. An access token is needed once to install the tables." };
    // Without a token we can't read the migration history, so probe what the newest migration adds.
    if (!(await newestSchemaInstalled(c))) {
      // Which files are missing is only known with the token (migration history), so none are listed here.
      return { state: "needs_token", pending: [], detail: "The tables exist but newer migrations are missing. Add an access token, then press Finish (or Check again to see which)." };
    }
    return { state: "ready", pending: [], detail: "The database is up to date." };
  }
  const applied = await appliedMigrations(ref, c.accessToken);
  // No migration history but the tables exist (set up by hand): treat every file as applied.
  if (!applied && installed) return { state: "ready", pending: [], detail: "The tables exist (no migration history recorded); nothing to install." };
  const pending = files.filter((f) => !applied?.versions.has(f.version) && !applied?.names.has(f.name));
  return pending.length
    ? { state: "pending", pending, detail: `${pending.length} migration(s) will be installed.` }
    : { state: "ready", pending: [], detail: "Every migration is already installed." };
}

async function applyMigrations(c: Connection, ref: string, pending: Migration[]): Promise<string> {
  const files = new Map(migrationFiles().map((f) => [f.version, f]));
  await managementQuery(
    ref,
    c.accessToken!,
    "create schema if not exists supabase_migrations; " +
      "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)",
  );
  for (const m of pending) {
    const f = files.get(m.version);
    if (!f) throw new Error(`Migration ${m.version} is no longer on disk.`);
    const raw = readFileSync(f.file, "utf8");
    const sql = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw; // some files were saved with a BOM
    // One transaction per file, recorded in the same history table the Supabase CLI uses. Version and name are
    // validated by the filename pattern (digits / [a-z0-9_]), so they are safe to inline.
    try {
      await managementQuery(
        ref,
        c.accessToken!,
        `begin;\n${sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name) values ('${f.version}', '${f.name}') on conflict do nothing;\ncommit;`,
      );
    } catch (e) {
      throw new Error(`${f.version}_${f.name}: ${(e as Error).message}`);
    }
  }
  return pending.map((m) => `${m.version}_${m.name}`).join(", ");
}

// ---------------------------------------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------------------------------------

async function allUsers(client: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Listing users failed: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

const roleOf = (u: User) => (u.app_metadata as { role?: string } | undefined)?.role;

// Creates the user, or updates the existing one with this email, with a confirmed email, this password and role.
async function upsertUser(client: SupabaseClient, users: User[], email: string, password: string, role: "admin" | "worker") {
  const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error } = await client.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { ...existing.app_metadata, role },
    });
    if (error) throw new Error(`Updating ${email} failed: ${error.message}`);
    return "updated";
  }
  const { error } = await client.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } });
  if (error) throw new Error(`Creating ${email} failed: ${error.message}`);
  return "created";
}

// ---------------------------------------------------------------------------------------------------------
// wizard entry points
// ---------------------------------------------------------------------------------------------------------

export async function checkSetup(c: Connection): Promise<SetupCheck> {
  await checkKeys(c);
  const ref = projectRef(c.supabaseUrl);
  const users = await allUsers(adminClient(c));
  const workerEmail = readConfig()?.workerEmail ?? DEFAULT_WORKER_EMAIL;
  return {
    projectRef: ref,
    db: await dbState(c, ref),
    admins: users.filter((u) => roleOf(u) === "admin").map((u) => u.email ?? u.id),
    workerExists: users.some((u) => u.email?.toLowerCase() === workerEmail.toLowerCase() && roleOf(u) === "worker"),
  };
}

// Runs every step in order and stops at the first failure. The config file is written last, so a failed run leaves
// the install as it was and can simply be run again.
export async function runSetup(input: SetupInput): Promise<{ ok: boolean; steps: SetupStep[] }> {
  const steps: SetupStep[] = [];
  const fail = (label: string, e: unknown) => {
    steps.push({ label, status: "error", detail: (e as Error).message });
    return { ok: false, steps };
  };

  const workerEmail = input.workerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(workerEmail)) return fail("Check input", new Error("Enter a valid worker email."));

  let check: SetupCheck;
  try {
    check = await checkSetup(input);
    steps.push({ label: "Connect to Supabase", status: "done", detail: normalizeUrl(input.supabaseUrl) });
  } catch (e) {
    return fail("Connect to Supabase", e);
  }

  // 1. database
  try {
    const { db } = check;
    if (db.state === "pending") {
      steps.push({ label: "Install database migrations", status: "done", detail: await applyMigrations(input, check.projectRef!, db.pending) });
    } else if (db.state === "ready") {
      steps.push({ label: "Install database migrations", status: "skipped", detail: db.detail });
    } else {
      throw new Error(db.detail);
    }
  } catch (e) {
    return fail("Install database migrations", e);
  }

  const client = adminClient(input);
  let users: User[];
  try {
    users = await allUsers(client);
  } catch (e) {
    return fail("Read users", e);
  }

  // 2. admin user: only when none exists yet
  try {
    const admins = users.filter((u) => roleOf(u) === "admin");
    if (admins.length) {
      steps.push({ label: "Admin user", status: "skipped", detail: `Already set up: ${admins.map((u) => u.email).join(", ")}` });
    } else {
      const email = input.adminEmail?.trim().toLowerCase() ?? "";
      const password = input.adminPassword ?? "";
      if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error("Enter a valid admin email.");
      if (password.length < 8) throw new Error("The admin password needs at least 8 characters.");
      const how = await upsertUser(client, users, email, password, "admin");
      steps.push({ label: "Admin user", status: "done", detail: `${email} ${how}` });
    }
  } catch (e) {
    return fail("Admin user", e);
  }

  // 3. worker user: always gets a fresh random password, stored only on this machine
  try {
    // Never turn an admin into the worker (that would lock the admin out), e.g. after a browser autofilled the field.
    const clash = users.find((u) => u.email?.toLowerCase() === workerEmail && roleOf(u) === "admin");
    if (clash || workerEmail === input.adminEmail?.trim().toLowerCase()) {
      throw new Error(`${workerEmail} is the admin account. The worker needs its own address, e.g. ${DEFAULT_WORKER_EMAIL}.`);
    }
    const password = randomBytes(24).toString("base64url");
    const how = await upsertUser(client, users, workerEmail, password, "worker");
    setLocalSecret("worker_password", password);
    steps.push({ label: "Worker user", status: "done", detail: `${workerEmail} ${how}; password stored in apps/worker/.secrets` });
  } catch (e) {
    return fail("Worker user", e);
  }

  // 4. config file
  try {
    const previous = readConfig();
    writeConfig({
      supabaseUrl: normalizeUrl(input.supabaseUrl),
      publishableKey: input.publishableKey.trim(),
      workerEmail,
      workerName: previous?.workerName,
      portfolioUrl: previous?.portfolioUrl,
    });
    steps.push({ label: "Save nexushq.config.json", status: "done", detail: "Admin, API and worker read it from now on." });
  } catch (e) {
    return fail("Save nexushq.config.json", e);
  }

  return { ok: true, steps };
}
