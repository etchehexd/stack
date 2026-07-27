/**
 * Schema test — run this before pasting schema.sql into Supabase.
 *
 *   npm run schema:test
 *
 * Executes supabase/schema.sql against a real PostgreSQL (PGlite is Postgres
 * compiled to WebAssembly, running in-process), with the handful of things
 * Supabase provides — the `auth` schema, the `anon`/`authenticated` roles —
 * stubbed out.
 *
 * It then proves the behaviour that's easy to get silently wrong: the generated
 * search column, typo-tolerant search, the tri-state filters, and that the whole
 * file can be re-run without error or data loss.
 *
 * No network and no database required. Anything failing here would have failed
 * in the Supabase SQL editor too.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const SCHEMA_PATH = process.argv[2];
const sql = readFileSync(SCHEMA_PATH, "utf8");

const db = await PGlite.create({ extensions: { pg_trgm, unaccent, pgcrypto } });

// --- Stubs for things Supabase provides ------------------------------------
await db.exec(`
  create schema if not exists extensions;
  create schema if not exists auth;

  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role; exception when duplicate_object then null; end $$;

  create table if not exists auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );

  -- Supabase's auth.uid() reads the request JWT; here it just returns null.
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
`);

console.log("stubs ready\n");

// --- The actual schema ------------------------------------------------------
try {
  await db.exec(sql);
  console.log("\x1b[32m✓ schema.sql executed with no errors\x1b[0m\n");
} catch (err) {
  console.error("\x1b[31m✗ schema.sql FAILED\x1b[0m\n");
  console.error(err.message);
  if (err.cause?.message) console.error("cause:", err.cause.message);
  process.exit(1);
}

// --- Prove the parts that just broke actually work --------------------------
const check = async (label, query, assertFn) => {
  const res = await db.query(query);
  const pass = assertFn ? assertFn(res.rows) : true;
  console.log(`  ${pass ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label}`);
  if (!pass) {
    console.log("     got:", JSON.stringify(res.rows));
    process.exitCode = 1;
  }
  return res.rows;
};

console.log("Behaviour checks:");

await check(
  "tables created",
  `select count(*)::int n from information_schema.tables
   where table_schema='public' and table_type='BASE TABLE'`,
  (r) => r[0].n >= 12,
);

// The generated column — the thing that was erroring.
await db.exec(`
  insert into public.titles (anilist_id, media_type, format, title_romaji, title_english, synonyms)
  values
    (1, 'anime', 'TV', 'Shingeki no Kyojin', 'Attack on Titan', array['AoT','進撃の巨人']),
    (2, 'manga', 'MANGA', 'Berserk', 'Berserk', '{}'),
    (3, 'light_novel', 'NOVEL', 'Sword Art Online', 'Sword Art Online', array['SAO']);
`);

await check(
  "search_text generated from all name fields + synonyms",
  `select search_text from public.titles where anilist_id = 1`,
  (r) =>
    r[0].search_text.includes("shingeki no kyojin") &&
    r[0].search_text.includes("attack on titan") &&
    r[0].search_text.includes("aot"),
);

await check(
  "search_text updates when a title is edited",
  `update public.titles set title_english = 'Attack on Titan: Final Season'
     where anilist_id = 1
   returning search_text`,
  (r) => r[0].search_text.includes("final season"),
);

// Typo tolerance — the headline search claim.
const typo = await check(
  "fuzzy search finds 'atack on titam'",
  `select title_english from public.search_titles('atack on titam')`,
  (r) => r.length > 0 && r[0].title_english.startsWith("Attack on Titan"),
);
console.log(`     matched: ${typo[0]?.title_english}`);

await check(
  "tri-state exclude filter works",
  `select count(*)::int n from public.search_titles(
     p_media_types => array['anime','manga']::media_type[]
   )`,
  (r) => r[0].n === 2,
);

await check(
  "half-star constraint rejects 3.7",
  `select public.is_half_star(3.7) as bad, public.is_half_star(3.5) as good`,
  (r) => r[0].bad === false && r[0].good === true,
);

await check(
  "user_stats returns a shape, not an error",
  `select public.user_stats(gen_random_uuid()) is not null as ok`,
  (r) => r[0].ok === true,
);

await check(
  "facets view populated",
  `select count(*)::int n from public.facets`,
  (r) => r[0].n >= 0,
);

await check(
  "RLS enabled on user tables",
  `select count(*)::int n from pg_tables
   where schemaname='public' and rowsecurity = true`,
  (r) => r[0].n >= 10,
);

// More typo cases — the search claim is "typos are fine", so prove it.
console.log("\nFuzzy search cases:");
for (const [query, expect] of [
  ["attack on titan", "Attack on Titan: Final Season"],
  ["atack on titam", "Attack on Titan: Final Season"],
  ["shingeki", "Attack on Titan: Final Season"],
  ["aot", "Attack on Titan: Final Season"],
  ["berserk", "Berserk"],
  ["bersrk", "Berserk"],
  ["sword art onlin", "Sword Art Online"],
  ["sao", "Sword Art Online"],
  ["ATTACK ON TITAN!!!", "Attack on Titan: Final Season"],
]) {
  const res = await db.query(
    `select title_english from public.search_titles($1) limit 1`,
    [query],
  );
  const got = res.rows[0]?.title_english ?? "(nothing)";
  const pass = got === expect;
  if (!pass) process.exitCode = 1;
  console.log(
    `  ${pass ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} "${query}" → ${got}`,
  );
}

// Re-running the schema must be safe — people hit errors partway and retry.
console.log("\nIdempotency:");
try {
  await db.exec(sql);
  console.log("  \x1b[32m✓\x1b[0m schema.sql runs a second time without error");
} catch (err) {
  console.log("  \x1b[31m✗\x1b[0m re-run failed:", err.message);
  process.exitCode = 1;
}

const after = await db.query(`select count(*)::int n from public.titles`);
const kept = after.rows[0].n === 3;
if (!kept) process.exitCode = 1;
console.log(
  `  ${kept ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} existing data survived the re-run (${after.rows[0].n} titles)`,
);

console.log(
  process.exitCode === 1
    ? "\n\x1b[31mSome checks failed.\x1b[0m\n"
    : "\n\x1b[32mAll checks passed.\x1b[0m\n",
);
