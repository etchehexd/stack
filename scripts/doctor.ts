/**
 * Setup diagnostics.
 *
 *   npm run doctor
 *
 * Walks the setup chain in order — env vars → connectivity → schema →
 * extensions → data — and stops at the first thing that's actually broken,
 * with the specific fix. Read-only: it never writes to your database.
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const warn = (m: string) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const info = (m: string) => console.log(`    \x1b[2m${m}\x1b[0m`);

function fail(heading: string, lines: string[]): never {
  console.log(`\n\x1b[31m${heading}\x1b[0m\n`);
  for (const line of lines) console.log(`  ${line}`);
  console.log("");
  process.exit(1);
}

const EXPECTED_TABLES = [
  "profiles",
  "titles",
  "title_relations",
  "ratings",
  "library_entries",
  "favorites",
  "lists",
  "list_items",
  "reviews",
  "follows",
  "activity",
  "airing_schedule",
];

async function main() {
  console.log("\n\x1b[1mStack setup check\x1b[0m\n");

  /* --- 1. env file ------------------------------------------------------- */
  console.log("\x1b[1m1. Environment\x1b[0m");

  if (!existsSync(".env.local")) {
    fail("No .env.local file.", [
      "Create it from the template:",
      "",
      "    cp .env.example .env.local",
      "",
      "Then fill in the values from your Supabase dashboard",
      "(Project Settings → Data API for the URL, → API Keys for the keys).",
      "",
      "See MANUAL_SETUP.md steps 1–3.",
    ]);
  }
  ok(".env.local exists");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anon && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    !service && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  if (missing.length) {
    fail(`Missing in .env.local: ${missing.join(", ")}`, [
      "Supabase dashboard → Project Settings:",
      "  • Data API  → Project URL      → NEXT_PUBLIC_SUPABASE_URL",
      "  • API Keys  → anon/publishable → NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "  • API Keys  → service_role     → SUPABASE_SERVICE_ROLE_KEY",
    ]);
  }

  if (url!.includes("YOUR-PROJECT-REF") || url!.includes("placeholder")) {
    fail("NEXT_PUBLIC_SUPABASE_URL is still the placeholder value.", [
      `Currently: ${url}`,
      "",
      "Replace it with your real project URL from the Supabase dashboard.",
    ]);
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url!)) {
    warn(`URL looks unusual: ${url}`);
    info("Expected something like https://abcdefghijk.supabase.co");
  } else {
    ok(`URL: ${url}`);
  }

  // The service key must not be the anon key — an easy and confusing mix-up.
  if (service === anon) {
    fail("SUPABASE_SERVICE_ROLE_KEY is the same as your anon key.", [
      "They're different keys. The service_role key is under",
      "Project Settings → API Keys, usually hidden behind a 'Reveal' button.",
      "",
      "Without it the sync can't write to the catalog tables.",
    ]);
  }
  ok("anon and service_role keys are present and distinct");

  /* --- 2. connectivity --------------------------------------------------- */
  console.log("\n\x1b[1m2. Connection\x1b[0m");

  const db = createClient(url!, service!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const probe = await db.from("titles").select("id", { count: "exact", head: true });

  if (probe.error) {
    const message = probe.error.message;

    if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(message)) {
      fail("Can't reach Supabase.", [
        `Tried: ${url}`,
        "",
        "Either the URL is wrong, the project is paused (free projects pause",
        "after a week of inactivity — open the dashboard to resume it), or",
        "something local is blocking the connection.",
      ]);
    }

    if (/relation .* does not exist|Could not find the table/i.test(message)) {
      fail("Connected, but the schema hasn't been created.", [
        "Open the Supabase dashboard → SQL Editor → New query,",
        "paste the entire contents of supabase/schema.sql, and Run.",
        "",
        "See MANUAL_SETUP.md step 2.",
      ]);
    }

    if (/JWT|Invalid API key|invalid claim/i.test(message)) {
      fail("The keys were rejected.", [
        `Supabase said: ${message}`,
        "",
        "Re-copy them from Project Settings → API Keys. Make sure the URL and",
        "the keys are from the SAME project.",
      ]);
    }

    fail("Unexpected error querying the database.", [message]);
  }

  ok("connected, and the titles table exists");

  /* --- 3. schema completeness -------------------------------------------- */
  console.log("\n\x1b[1m3. Schema\x1b[0m");

  const missingTables: string[] = [];
  for (const table of EXPECTED_TABLES) {
    const res = await db.from(table).select("*", { count: "exact", head: true });
    if (res.error && /does not exist|Could not find/i.test(res.error.message)) {
      missingTables.push(table);
    }
  }

  if (missingTables.length) {
    fail(`Missing ${missingTables.length} table(s): ${missingTables.join(", ")}`, [
      "The schema was only partially applied — probably an error partway",
      "through the SQL editor run.",
      "",
      "Re-run the whole of supabase/schema.sql. It's safe to run again.",
    ]);
  }
  ok(`all ${EXPECTED_TABLES.length} tables present`);

  // The search RPC is the piece most likely to be missing if pg_trgm failed.
  const rpc = await db.rpc("search_titles", { p_query: "test", p_limit: 1 });
  if (rpc.error) {
    if (/function .* does not exist/i.test(rpc.error.message)) {
      fail("The search_titles function is missing.", [
        "Tables exist but the functions didn't get created — the SQL run",
        "probably failed partway. Re-run supabase/schema.sql in full.",
      ]);
    }
    if (/similarity|gin_trgm|operator does not exist/i.test(rpc.error.message)) {
      fail("Search is broken — the pg_trgm extension isn't enabled.", [
        `Supabase said: ${rpc.error.message}`,
        "",
        "Dashboard → Database → Extensions, search for 'pg_trgm', enable it.",
        "Also enable 'unaccent'. Then re-run supabase/schema.sql.",
      ]);
    }
    warn(`search_titles returned an error: ${rpc.error.message}`);
  } else {
    ok("search_titles works (pg_trgm is enabled)");
  }

  /* --- 4. data ----------------------------------------------------------- */
  console.log("\n\x1b[1m4. Catalog\x1b[0m");

  const [titles, anime, manga, ln, airing, profiles] = await Promise.all([
    db.from("titles").select("id", { count: "exact", head: true }),
    db.from("titles").select("id", { count: "exact", head: true }).eq("media_type", "anime"),
    db.from("titles").select("id", { count: "exact", head: true }).eq("media_type", "manga"),
    db.from("titles").select("id", { count: "exact", head: true }).eq("media_type", "light_novel"),
    db.from("airing_schedule").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const total = titles.count ?? 0;

  if (total === 0) {
    console.log("");
    fail("Everything is set up correctly — there's just no data yet.", [
      "Run the catalog sync:",
      "",
      "    npm run sync:seed",
      "",
      "It pulls ~2,500 titles from AniList and takes 3–5 minutes.",
    ]);
  }

  ok(`${total.toLocaleString()} titles`);
  info(
    `anime ${anime.count ?? 0} · manga ${manga.count ?? 0} · light novels ${ln.count ?? 0}`,
  );

  if ((ln.count ?? 0) === 0) {
    warn("No light novels — run `npm run sync:seed` for the manga passes.");
  }
  if ((airing.count ?? 0) === 0) {
    warn("No airing schedule — the Calendar will be empty. Run `npm run sync:airing`.");
  } else {
    ok(`${airing.count} scheduled episodes`);
  }

  ok(`${profiles.count ?? 0} user account(s)`);

  /* --- 5. app env -------------------------------------------------------- */
  console.log("\n\x1b[1m5. App settings\x1b[0m");

  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    warn("NEXT_PUBLIC_SITE_URL not set — OAuth redirects fall back to the request host.");
  } else {
    ok(`site URL: ${process.env.NEXT_PUBLIC_SITE_URL}`);
  }

  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.includes("generate-a-random")) {
    warn("CRON_SECRET not set — /api/cron/sync will reject all requests.");
  } else {
    ok("CRON_SECRET set");
  }

  console.log("\n\x1b[32mAll good.\x1b[0m Run `npm run dev` and open http://localhost:3000\n");
}

main().catch((err) => {
  console.error("\n\x1b[31mdoctor crashed:\x1b[0m", err instanceof Error ? err.message : err);
  process.exit(1);
});
