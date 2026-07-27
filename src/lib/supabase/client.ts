"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Supabase client for Client Components. Safe to call repeatedly — @supabase/ssr
 * memoizes the underlying instance per browser session.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}
