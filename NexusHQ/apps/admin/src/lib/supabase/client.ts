import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { publicConfig } from "@/lib/publicConfig";

// Browser client: carries the signed-in admin's session (cookies), so Storage uploads and reads go through RLS.
// URL and key come from the runtime config (ConfigBridge), not build-time env.
export function createClient() {
  const { supabaseUrl, publishableKey } = publicConfig();
  return createBrowserClient<Database>(supabaseUrl, publishableKey);
}
