// NexusHQ local worker, v1: keeps the admin's AI agent settings page alive. It signs in to Supabase, reports
// this machine's hardware and every provider's status, and runs admin commands (test a connection, refresh
// model lists, pull an Ollama model). The Upwork job pipeline plugs into runAgent() later (plan §6).
//
// Provider API keys and cloud credentials are set in the admin (AI agents → API keys) and fetched from Supabase
// Vault; only the worker's own sign-in password is stored here.
//
//   npm run worker                              start the worker
//   npm run worker -- keys set worker_password  store the worker's Supabase password (asked for without echo)
//   npm run worker -- keys list | unset worker_password
import type { SupabaseClient } from "@supabase/supabase-js";
import os from "node:os";
import { readFileSync } from "node:fs";
import { loadAgentConfigs } from "./agents.ts";
import { handleCommand, type CommandRow } from "./commands.ts";
import { detectHardware } from "./hardware.ts";
import { isLocalSecretName, loadLocalSecrets, LOCAL_SECRET_NAMES, promptHidden, setLocalSecret, syncSecrets } from "./secrets.ts";
import { Status } from "./status.ts";
import { connect, workerLogin } from "./supabase.ts";

const POLL_MS = 3_000;
const HEARTBEAT_MS = 30_000;
const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function keysCli([action, name]: string[]) {
  if (action === "list" || !action) {
    const have = loadLocalSecrets();
    for (const n of LOCAL_SECRET_NAMES) console.log(`${have[n] ? "✓" : "·"} ${n}`);
    console.log("Provider API keys are set in the admin: Upwork cockpit → AI agents → API keys.");
    return;
  }
  if (!name || !isLocalSecretName(name)) {
    console.error(`Usage: keys set|unset worker_password. Provider API keys are set in the admin (AI agents → API keys), not here.`);
    process.exit(1);
  }
  if (action === "unset") {
    setLocalSecret(name, null);
    console.log(`Removed ${name}.`);
    return;
  }
  if (action === "set") {
    const value = (await promptHidden(`${name}: `)).trim();
    if (!value) return console.log("Nothing entered; unchanged.");
    setLocalSecret(name, value);
    console.log(`Stored ${name}${process.platform === "win32" ? " (DPAPI-encrypted for this Windows user)" : ""}.`);
    return;
  }
  console.error(`Unknown keys action "${action}"`);
  process.exit(1);
}

const SETUP_POLL_MS = 5_000;

// Waits until the admin's setup wizard has written the config and the worker password, then signs in. It keeps
// retrying a failed sign-in too, so finishing (or re-running) setup brings the worker online without a restart.
async function waitForLogin() {
  let said = "";
  for (;;) {
    const login = workerLogin();
    let problem: string;
    if ("missing" in login) {
      problem = `waiting for setup (missing ${login.missing}); finish it in the admin at http://localhost:3100/setup`;
    } else {
      try {
        return { supabase: await connect(login), name: login.name };
      } catch (e) {
        problem = `${(e as Error).message}; retrying (re-run setup in the admin if this persists)`;
      }
    }
    if (problem !== said) log(problem);
    said = problem;
    await new Promise((r) => setTimeout(r, SETUP_POLL_MS));
  }
}

async function runWorker() {
  const { supabase, name } = await waitForLogin();
  const status = new Status(supabase, name || os.hostname(), VERSION);
  await status.load();
  status.row.hardware = await detectHardware();
  log(`worker ${VERSION} signed in; ${status.row.hardware.ramGb} GB RAM, ${status.row.hardware.gpus.map((g) => g.model).join(", ") || "no GPU"}`);
  await syncSecrets(supabase);
  await status.refreshAll(await loadAgentConfigs(supabase));
  await status.refreshMcp();
  await status.save();
  if (!status.mcpReady) log("MCP connections are hidden until migration 20261023120000_mcp_connections is applied (re-run /setup with an access token)");
  log("provider and MCP status reported; waiting for commands");

  await resetOrphanedRuns(supabase);
  let lastBeat = Date.now();
  let stopping = false;
  const stop = () => { stopping = true; log("stopping after the current command…"); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    try {
      const { data, error } = await supabase.rpc("claim_next_command");
      if (error) throw new Error(`claim_next_command: ${error.message}`);
      const cmd = (data as CommandRow[] | null)?.[0];
      if (cmd) {
        log(`→ ${cmd.kind}`, JSON.stringify(cmd.payload));
        let update: Record<string, unknown>;
        // Long commands (a Find jobs run takes minutes) keep the heartbeat going so the admin shows us online.
        const beat = setInterval(() => { status.save().catch(() => {}); }, HEARTBEAT_MS);
        try {
          await syncSecrets(supabase); // pick up keys changed in the admin since the last command
          const result = await handleCommand(cmd, { supabase, status });
          update = { status: "done", result, error: null };
          log(`✓ ${cmd.kind}`);
        } catch (e) {
          update = { status: "error", error: (e as Error).message.slice(0, 2000) };
          log(`✗ ${cmd.kind}: ${(e as Error).message}`);
        } finally {
          clearInterval(beat);
        }
        await supabase.from("commands").update({ ...update, finished_at: new Date().toISOString() }).eq("id", cmd.id);
        await status.save();
        lastBeat = Date.now();
        continue; // drain the queue before sleeping
      }
      if (Date.now() - lastBeat > HEARTBEAT_MS) {
        await resetOrphanedRuns(supabase);
        await syncSecrets(supabase);
        status.row.hardware = { ...status.row.hardware, freeRamGb: (await detectHardware()).freeRamGb };
        await status.save();
        lastBeat = Date.now();
      }
    } catch (e) {
      log(`loop error: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await supabase.auth.signOut();
}

const [cmd, ...rest] = process.argv.slice(2);
(cmd === "keys" ? keysCli(rest) : runWorker()).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});

// Only called while no command is running, so any run still marked running/stopping lost its worker (crash or restart).
async function resetOrphanedRuns(supabase: SupabaseClient) {
  const note = "Reset: the worker stopped during this run";
  const { data } = await supabase.from("job_runs")
    .update({ status: "error", error: note, finished_at: new Date().toISOString() })
    .in("status", ["running", "stopping"]).select("id");
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return;
  await supabase.from("jobs").update({ stage: "filtered_out", reason: `Not checked: ${note}` }).in("run_id", ids).eq("stage", "found");
  log(`reset ${ids.length} orphaned run(s)`);
}
