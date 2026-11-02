"use client";

import { setPublicConfig, type PublicConfig } from "@/lib/publicConfig";

// Hands the runtime config from the root layout (server) to client code, both during SSR and in the browser. It sets
// the value while rendering, before its children render, so every client component below can call publicConfig().
export default function ConfigBridge({ config, children }: { config: PublicConfig | null; children: React.ReactNode }) {
  if (config) setPublicConfig(config);
  return children;
}
