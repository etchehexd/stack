/**
 * Is Supabase actually configured?
 *
 * These must be referenced as literal `process.env.X` expressions — Next.js
 * inlines `NEXT_PUBLIC_*` at BUILD time, so dynamic lookups resolve to
 * undefined in the browser bundle.
 *
 * Note the build-time inlining has a consequence worth remembering: adding
 * these variables in Vercel does NOT affect an existing deployment. You have to
 * redeploy for them to take effect.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True only when both values are present and not the template placeholders.
 *
 * Everything that builds a Supabase client should check this first, rather than
 * letting `createClient` throw — an uncaught throw in the root layout turns
 * every route into an opaque 500 with no indication of the cause.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
      !SUPABASE_ANON_KEY.startsWith("your-"),
  );
}
