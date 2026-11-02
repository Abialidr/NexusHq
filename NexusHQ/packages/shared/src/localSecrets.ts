// The worker's machine-local secrets in apps/worker/.secrets: today only its own Supabase sign-in password, which it
// needs before it can reach Supabase (provider keys live in Supabase Vault, see secrets.ts). DPAPI-encrypted for the
// current Windows user (PowerShell SecureString, no native module), plain JSON with 0600 permissions elsewhere.
// Shared so the admin's setup wizard, running on the same machine and Windows user, can store the password it
// generates for the worker. Node-only: imported as @nexushq/shared/local-secrets.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./config.ts";

const WIN = process.platform === "win32";

export const LOCAL_SECRET_NAMES = ["worker_password"] as const;
export type LocalSecretName = (typeof LOCAL_SECRET_NAMES)[number];
type Secrets = Partial<Record<LocalSecretName, string>>;

let cache: { mtime: number; data: Secrets } | null = null;

export const localSecretsPath = () => path.join(repoRoot(), "apps", "worker", ".secrets");

function powershell(script: string, input: string): string {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { input, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`DPAPI call failed: ${(r.stderr || r.error?.message || "").trim()}`);
  return r.stdout.trim();
}

function encrypt(plain: string): string {
  if (!WIN) return plain;
  return powershell("$s = [Console]::In.ReadToEnd(); ConvertTo-SecureString -String $s -AsPlainText -Force | ConvertFrom-SecureString", plain);
}

function decrypt(blob: string): string {
  if (!WIN) return blob;
  return powershell(
    "$ss = ConvertTo-SecureString -String ([Console]::In.ReadToEnd().Trim()); " +
      "[Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss))",
    blob,
  );
}

export function loadLocalSecrets(): Secrets {
  const file = localSecretsPath();
  if (!existsSync(file)) return {};
  const mtime = statSync(file).mtimeMs;
  if (cache?.mtime === mtime) return cache.data;
  const data = JSON.parse(decrypt(readFileSync(file, "utf8")) || "{}") as Secrets;
  cache = { mtime, data };
  return data;
}

export function getLocalSecret(name: LocalSecretName): string | undefined {
  return loadLocalSecrets()[name] || undefined;
}

export function setLocalSecret(name: LocalSecretName, value: string | null) {
  const file = localSecretsPath();
  const data = { ...loadLocalSecrets() };
  if (value) data[name] = value; else delete data[name];
  writeFileSync(file, encrypt(JSON.stringify(data)), { mode: 0o600 });
  if (!WIN) chmodSync(file, 0o600);
  cache = null;
}

export function isLocalSecretName(v: string): v is LocalSecretName {
  return (LOCAL_SECRET_NAMES as readonly string[]).includes(v);
}
