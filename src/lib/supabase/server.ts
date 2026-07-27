import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * `cookies()` is async in Next 16, so this function is async too.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // proxy.ts refreshes the session, so this is safe to swallow.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, or null. Uses getUser() rather than getSession() because
 * getUser() revalidates the JWT against the auth server — getSession() trusts
 * the cookie, which is spoofable on the server.
 *
 * Returns null (rather than throwing) when Supabase isn't configured, so a
 * missing env var surfaces as a setup screen instead of a blank 500.
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The signed-in user's profile row, or null. */
export async function getCurrentProfile() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}
