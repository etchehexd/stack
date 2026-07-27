import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/**
 * Next 16 renamed `middleware` to `proxy` (nodejs runtime, not configurable).
 *
 * All this does is refresh the Supabase auth token on every request and write
 * the rotated cookies back onto the response. Route protection lives in the
 * pages themselves — proxy checks are optimistic only, per the Next.js auth
 * guidance.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Without credentials there is no session to refresh, and constructing the
  // client would throw — failing every request before any page renders.
  // Send everything to /setup so no page runs a query it can't complete.
  if (!isSupabaseConfigured()) {
    const { pathname } = request.nextUrl;
    if (pathname === "/setup" || pathname.startsWith("/api/")) return response;
    return NextResponse.rewrite(new URL("/setup", request.url));
  }

  const supabase = createServerClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not remove: this call is what triggers the token refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Keeping the matcher
     * tight matters — this runs on every matched request.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
