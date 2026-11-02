import "server-only";
import { readConfig, type NexusConfig } from "@nexushq/shared/config";
import { setPublicConfig, type PublicConfig } from "@/lib/publicConfig";

// The current install config (nexushq.config.json, else .env.local), re-read when the file changes. Null until the
// setup wizard has run. Also refreshes publicConfig() for server code that builds public URLs.
export function getConfig(): NexusConfig | null {
  const config = readConfig();
  setPublicConfig(config && toPublic(config));
  return config;
}

export function requireConfig(): NexusConfig {
  const config = getConfig();
  if (!config) throw new Error("NexusHQ is not set up yet. Open /setup to connect Supabase.");
  return config;
}

export function toPublic(config: NexusConfig): PublicConfig {
  return { supabaseUrl: config.supabaseUrl, publishableKey: config.publishableKey, portfolioUrl: config.portfolioUrl };
}
