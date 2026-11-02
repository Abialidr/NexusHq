// The public part of nexushq.config.json (Supabase URL + publishable key + portfolio link), usable from server and
// client code alike. It is read at runtime, not inlined at build time like NEXT_PUBLIC_* vars, so the setup wizard
// can change it without a rebuild. The server side fills it from getConfig() (lib/config.ts); the browser and SSR of
// client components get it from <ConfigBridge> in the root layout. It is one value per install, never per user.
export interface PublicConfig {
  supabaseUrl: string;
  publishableKey: string;
  portfolioUrl?: string;
}

let current: PublicConfig | null = null;

export function setPublicConfig(config: PublicConfig | null) {
  current = config;
}

export function publicConfig(): PublicConfig {
  if (current) return current;
  // Before any config is known (e.g. the setup page itself): the old build-time env, or empty strings.
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    portfolioUrl: process.env.NEXT_PUBLIC_PORTFOLIO_URL,
  };
}
