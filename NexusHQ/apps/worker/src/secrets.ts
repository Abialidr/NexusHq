// Two kinds of secret:
//  - Provider keys and cloud credentials (Anthropic, OpenAI, AWS, Vertex …) are set in the admin and stored
//    encrypted in Supabase Vault. The worker fetches them with get_agent_secrets() (worker role only) and keeps
//    them in memory; syncSecrets() refreshes them every command and heartbeat, so a key changed in the admin is
//    picked up without a restart.
//  - The worker's own Supabase sign-in password is the one thing it needs before it can reach Supabase, so it
//    stays on this machine in apps/worker/.secrets (DPAPI-encrypted on Windows). That file is handled by
//    @nexushq/shared/local-secrets, which the admin's setup wizard also uses to store the password it generates.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSecretName, type SecretName } from "@nexushq/shared";

export { LOCAL_SECRET_NAMES, getLocalSecret, isLocalSecretName, loadLocalSecrets, setLocalSecret, type LocalSecretName } from "@nexushq/shared/local-secrets";

let remote: Partial<Record<SecretName, string>> = {};

export async function syncSecrets(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_agent_secrets");
  if (error) throw new Error(`Fetching provider keys from the admin failed: ${error.message}`);
  const next: Partial<Record<SecretName, string>> = {};
  for (const [k, v] of Object.entries((data ?? {}) as Record<string, unknown>)) {
    if (isSecretName(k) && typeof v === "string" && v) next[k] = v;
  }
  remote = next;
}

// A provider key or credential set in the admin, as of the last syncSecrets().
export function getSecret(name: SecretName): string | undefined {
  return remote[name];
}

// Reads one line from the terminal without echoing it.
export function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let value = "";
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.off("data", onData);
          if (stdin.isTTY) stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") process.exit(130);
        if (c === "\u0008" || c === "\u007f") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}
