// Provider id -> adapter. `satisfies` makes a missing provider a type error when one is added to the catalog.
import type { ProviderId } from "@nexushq/shared";
import { agyCli, claudeCli, codexCli } from "./cli.ts";
import { anthropic, bedrock, gemini, openai, vertex } from "./cloud.ts";
import { ollama, openaiCompat } from "./local.ts";
import type { Adapter } from "./types.ts";

export const ADAPTERS = {
  ollama, openai_compat: openaiCompat,
  claude_cli: claudeCli, codex_cli: codexCli, agy_cli: agyCli,
  anthropic, bedrock, vertex, openai, gemini,
} satisfies Record<ProviderId, Adapter>;

export function adapterFor(id: ProviderId): Adapter {
  return ADAPTERS[id];
}

export type { Adapter, CallResult, Usage } from "./types.ts";
