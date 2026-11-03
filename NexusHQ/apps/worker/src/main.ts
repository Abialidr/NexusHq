// NexusHQ local worker, v1: keeps the admin's AI agent settings page alive. It signs in to Supabase, reports
// this machine's hardware and every provider's status, and runs admin commands (test a connection, refresh
// model lists, pull an Ollama model). The Upwork job pipeline plugs into runAgent() later (plan §6).
//
// Provider API keys and cloud credentials are set in the admin (AI agents → API keys) and fetched from Supabase
// Vault; only the worker's own sign-in password is stored here.
//
//   npm run worker                              start the worker
//   npm run worker -- --find-jobs[=focus]       start the worker and run Find jobs right away, logging here
//   npm run dev -- --find-jobs[=focus]          same, from the repo root with admin + api
//     add --listings=20 --shortlist=15          this run's accepted (never-seen) listings and shortlist % (instead of the admin's)
//     add --hours=8 --progress=2                scout time cap (default 10 h) and progress report every N minutes (default 2)
//     add --classic-search                      old one-shot search rounds instead of the scout
//   npm run worker -- check                     are the 3 CLIs signed in and connected to the Upwork MCP? (exit 0/1)
//   npm run worker -- keys set worker_password  store the worker's Supabase password (asked for without echo)
//   npm run worker -- keys list | unset worker_password
import { MCP_CLI_CAPS, MCP_CLIS } from "@nexushq/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import os from "node:os";
import { readFileSync } from "node:fs";
import { loadAgentConfigs } from "./agents.ts";
import { handleCommand, type CommandRow } from "./commands.ts";
import { detectHardware } from "./hardware.ts";
import { runFindJobs } from "./pipeline.ts";
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

// `--find-jobs[=focus]`: start a Find jobs run as soon as we're signed in, with its log printed here as well as
// in the admin. The worker then carries on with the command loop as usual.
// `--listings=N` and `--shortlist=P` override the admin's "Max listings per run" and "Shortlist %" for that run only.
// concurrently's {@} passthrough shell-escapes the value (`--find-jobs\=react`), hence the backslash unescaping.
const ARGS = process.argv.slice(2).map((a) => a.replace(/\\(.)/g, "$1"));
const flag = (name: string) => {
  const a = ARGS.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  return a === undefined ? null : a.slice(name.length + 3).trim();
};
const numFlag = (name: string) => {
  const v = flag(name);
  if (v === null) return undefined;
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) throw new Error(`--${name} needs a positive number, got "${v}"`);
  return n;
};
const findJobs = flag("find-jobs")?.slice(0, 200) ?? null;
// --hours=H caps the scout's search time (default 10), --progress=M sets the progress-report interval in minutes
// (default 2), --classic-search uses the old one-shot search rounds instead of the scout.
const findLimits = {
  maxJobs: numFlag("listings"), shortlistPercent: numFlag("shortlist"), hours: numFlag("hours"), progressMin: numFlag("progress"),
  classicSearch: flag("classic-search") !== null,
};

// All three CLIs installed and signed in, and each connected to the Upwork MCP. Prints one line per check, saves the
// result to worker_status (so the admin shows it too) and returns whether everything passed.
async function checkConnections(supabase: SupabaseClient, status: Status) {
  await syncSecrets(supabase);
  const configs = await loadAgentConfigs(supabase);
  await Promise.all(MCP_CLIS.map((id) => status.refreshProvider(id, configs.find((c) => c.provider === id))));
  await Promise.all(MCP_CLIS.map((id) => status.refreshMcp(id, "upwork")));
  await status.save();
  let ok = true;
  for (const id of MCP_CLIS) {
    const cli = status.row.providers[id];
    const mcp = status.row.mcp[id]?.upwork;
    const mcpOk = mcp?.auth === "connected";
    ok &&= !!cli?.available && mcpOk;
    console.log(`  ${cli?.available ? "✓" : "✗"} ${MCP_CLI_CAPS[id].label.padEnd(12)} ${cli?.detail ?? "not checked"}`);
    console.log(`  ${mcpOk ? "✓" : "✗"} ${"".padEnd(12)} Upwork MCP: ${mcp?.auth ?? "not checked"}${mcp?.detail ? ` · ${mcp.detail}` : ""}`);
  }
  return ok;
}

// `npm run worker -- check`: sign in, run checkConnections, exit 0 if everything is connected, 1 if not.
async function runCheck() {
  const { supabase, name } = await waitForLogin();
  const status = new Status(supabase, name || os.hostname(), VERSION);
  await status.load();
  log("checking CLIs and the Upwork MCP…");
  const ok = await checkConnections(supabase, status);
  log(ok ? "✓ everything is connected" : "✗ something is not connected (see above)");
  await supabase.auth.signOut();
  process.exit(ok ? 0 : 1);
}

async function findJobsNow(supabase: SupabaseClient, status: Status, focus: string) {
  const sizes = [findLimits.maxJobs && `${findLimits.maxJobs} listings`, findLimits.shortlistPercent && `shortlist ${findLimits.shortlistPercent}%`];
  log(`→ find jobs (--find-jobs)${focus ? ` focus "${focus}"` : ""}${sizes.some(Boolean) ? ` · ${sizes.filter(Boolean).join(", ")}` : ""}`);
  log("checking CLIs and the Upwork MCP first…");
  if (!(await checkConnections(supabase, status))) {
    log("✗ find jobs skipped: fix the connections above (admin → AI agents → Connections), then restart");
    return;
  }
  const beat = setInterval(() => { status.save().catch(() => {}); }, HEARTBEAT_MS);
  try {
    await syncSecrets(supabase);
    const r = await runFindJobs(supabase, focus, { ...findLimits, onLog: (line) => console.log(`  ${line}`) });
    log(`✓ find jobs finished (run ${r.run_id})`);
    console.log([
      "  ┌─ summary ─────────────────────────────",
      `  │ judged by the scout   ${r.found}`,
      `  │ accepted (saved)      ${r.new}`,
      `  │ rejected by the scout ${r.screened_out}`,
      `  │ dropped by gates      ${r.gated_out}`,
      `  │ dropped by Claude     ${r.filtered_out}`,
      `  │ shortlisted           ${r.shortlisted}`,
      `  │ drafted               ${r.drafted}`,
      "  └───────────────────────────────────────",
    ].join("\n"));
  } catch (e) {
    log(`✗ find jobs: ${(e as Error).message}`);
  } finally {
    clearInterval(beat);
  }
  await status.save();
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
  if (findJobs !== null) await findJobsNow(supabase, status, findJobs);
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
(cmd === "keys" ? keysCli(rest) : cmd === "check" ? runCheck() : runWorker()).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});

// Only called while no command is running, so any run still marked running/stopping lost its worker (crash or restart).
async function resetOrphanedRuns(supabase: SupabaseClient) {
  const note = "Reset: the worker stopped during this run";
  await supabase.from("commands").update({ status: "error", error: note, finished_at: new Date().toISOString() }).eq("status", "running");
  const { data } = await supabase.from("job_runs")
    .update({ status: "error", error: note, finished_at: new Date().toISOString() })
    .in("status", ["running", "stopping"]).select("id");
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return;
  await supabase.from("jobs").update({ stage: "filtered_out", reason: `Not checked: ${note}` }).in("run_id", ids).eq("stage", "found");
  log(`reset ${ids.length} orphaned run(s)`);
}
