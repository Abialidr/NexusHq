import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readConfig } from "@nexushq/shared/config";
import type { Database } from "@/lib/database.types";
import { HOSTED } from "@/lib/hosted";

const PUBLIC_PATHS = ["/login", "/kind-words"];

// Refreshes the auth session cookie on every request and bounces signed-out visitors to /login.
// This is only a convenience redirect: real authorization is requireAdmin() on the server plus RLS.
// Before setup has run there is no Supabase to ask, so every page goes to the setup wizard instead.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const config = readConfig();
  if (!config) {
    // The hosted admin has no setup wizard: its Supabase URL + key come from the host's environment variables.
    if (HOSTED) {
      return new NextResponse(
        "NexusHQ hosted admin: Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the host's environment variables (Production), then redeploy.",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    if (request.nextUrl.pathname === "/setup") return response;
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient<Database>(
    config.supabaseUrl,
    config.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // Do not put code between client creation and getClaims(): it is what refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;

  if (!data?.claims && !PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
