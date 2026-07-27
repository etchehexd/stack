/**
 * AniList → Supabase catalog sync.
 *
 *   npm run sync:seed      # first run: pull the top N of each media type
 *   npm run sync:refresh   # ongoing: current season + airing schedule + stale rows
 *   npm run sync:airing    # just the airing schedule (cheap, run daily)
 *
 * Uses the SERVICE ROLE key because the catalog tables have no client-side
 * write policies. Never run this from the browser.
 *
 * Safe to interrupt and re-run: every write is an upsert keyed on anilist_id.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import {
  AIRING_QUERY,
  BY_IDS_QUERY,
  PAGE_QUERY,
  SEASON_QUERY,
  anilistRequest,
  extractRelations,
  mapMediaToTitleRow,
  type AiringResponse,
  type AniListMedia,
  type PageResponse,
} from "../src/lib/anilist";
import { currentSeason } from "../src/lib/utils";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "\n  Missing env vars. Copy .env.example to .env.local and fill in:\n" +
      "    NEXT_PUBLIC_SUPABASE_URL\n" +
      "    SUPABASE_SERVICE_ROLE_KEY\n",
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

let written = 0;

function log(...args: unknown[]) {
  console.log("[sync]", ...args);
}

/** Upsert a batch of AniList media into `titles`. Returns anilist_id -> uuid. */
async function upsertTitles(media: AniListMedia[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (media.length === 0) return map;

  // Dedupe within the batch — a paged query can return the same id twice when
  // AniList's underlying ordering shifts between requests.
  const byId = new Map<number, AniListMedia>();
  for (const m of media) byId.set(m.id, m);

  const rows = [...byId.values()].map(mapMediaToTitleRow);

  const { data, error } = await db
    .from("titles")
    .upsert(rows, { onConflict: "anilist_id" })
    .select("id, anilist_id");

  if (error) throw new Error(`titles upsert failed: ${error.message}`);

  for (const row of data ?? []) map.set(row.anilist_id, row.id);
  written += rows.length;
  return map;
}

/**
 * Persist franchise relations. Only edges where BOTH ends already exist in our
 * DB are stored — dangling targets are skipped rather than backfilled, so a
 * sync never cascades into fetching the entire AniList graph. Run
 * `npm run sync:relations` afterwards to fill in missing targets.
 */
async function upsertRelations(media: AniListMedia[]) {
  const edges = media.flatMap(extractRelations);
  if (edges.length === 0) return;

  const anilistIds = [
    ...new Set(edges.flatMap((e) => [e.sourceAnilistId, e.targetAnilistId])),
  ];

  const { data: known } = await db
    .from("titles")
    .select("id, anilist_id")
    .in("anilist_id", anilistIds);

  const idMap = new Map((known ?? []).map((t) => [t.anilist_id, t.id]));

  const rows = edges
    .map((e) => ({
      source_id: idMap.get(e.sourceAnilistId),
      target_id: idMap.get(e.targetAnilistId),
      relation_type: e.relationType,
    }))
    .filter(
      (r): r is { source_id: string; target_id: string; relation_type: string } =>
        Boolean(r.source_id && r.target_id),
    );

  if (rows.length === 0) return;

  const { error } = await db
    .from("title_relations")
    .upsert(rows, { onConflict: "source_id,target_id,relation_type" });

  if (error) console.warn("[sync] relations upsert warning:", error.message);
}

/* -------------------------------------------------------------------------- */
/* Seed: bulk-pull the catalog                                                */
/* -------------------------------------------------------------------------- */

interface SeedPass {
  label: string;
  type: "ANIME" | "MANGA";
  sort: string[];
  pages: number;
}

/**
 * DECISION: seed = top 10 pages (500 titles) by popularity per pass, plus a
 * score pass to catch acclaimed-but-obscure titles. ~2,500 titles total, which
 * takes roughly 3 minutes and comfortably fits Supabase's free tier.
 * Raise `pages` if you want a deeper catalog.
 */
const SEED_PASSES: SeedPass[] = [
  { label: "anime · popular", type: "ANIME", sort: ["POPULARITY_DESC"], pages: 10 },
  { label: "anime · acclaimed", type: "ANIME", sort: ["SCORE_DESC"], pages: 6 },
  { label: "anime · trending", type: "ANIME", sort: ["TRENDING_DESC"], pages: 2 },
  { label: "manga+ln · popular", type: "MANGA", sort: ["POPULARITY_DESC"], pages: 10 },
  { label: "manga+ln · acclaimed", type: "MANGA", sort: ["SCORE_DESC"], pages: 6 },
];

async function seed() {
  for (const pass of SEED_PASSES) {
    log(`pass: ${pass.label} (${pass.pages} pages)`);
    for (let page = 1; page <= pass.pages; page++) {
      const data = await anilistRequest<PageResponse>(PAGE_QUERY, {
        page,
        perPage: 50,
        type: pass.type,
        sort: pass.sort,
      });

      const media = data.Page.media;
      await upsertTitles(media);
      await upsertRelations(media);

      log(`  page ${page}/${pass.pages} · ${media.length} titles · ${written} total`);
      if (!data.Page.pageInfo.hasNextPage) break;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Season refresh                                                             */
/* -------------------------------------------------------------------------- */

async function syncSeason(season?: string, year?: number) {
  const now = currentSeason();
  const s = season ?? now.season;
  const y = year ?? now.year;

  log(`season: ${s} ${y}`);
  for (let page = 1; page <= 4; page++) {
    const data = await anilistRequest<PageResponse>(SEASON_QUERY, {
      page,
      perPage: 50,
      season: s,
      seasonYear: y,
    });
    await upsertTitles(data.Page.media);
    await upsertRelations(data.Page.media);
    log(`  page ${page} · ${data.Page.media.length} titles`);
    if (!data.Page.pageInfo.hasNextPage) break;
  }
}

/* -------------------------------------------------------------------------- */
/* Airing schedule                                                            */
/* -------------------------------------------------------------------------- */

/** Pull the airing window from 2 days ago to 14 days out. */
async function syncAiring(daysBack = 2, daysForward = 14) {
  const start = Math.floor(Date.now() / 1000) - daysBack * 86_400;
  const end = Math.floor(Date.now() / 1000) + daysForward * 86_400;

  log(`airing schedule: -${daysBack}d … +${daysForward}d`);

  let page = 1;
  let total = 0;

  while (page <= 20) {
    const data = await anilistRequest<AiringResponse>(AIRING_QUERY, {
      page,
      start,
      end,
    });

    const schedules = data.Page.airingSchedules;
    if (schedules.length === 0) break;

    // The airing feed carries full media objects, so we can upsert the titles
    // themselves at the same time — this is how brand-new shows enter the DB.
    const idMap = await upsertTitles(schedules.map((s) => s.media));

    const rows = schedules
      .map((s) => ({
        id: s.id,
        title_id: idMap.get(s.media.id),
        episode: s.episode,
        airing_at: new Date(s.airingAt * 1000).toISOString(),
      }))
      .filter((r): r is { id: number; title_id: string; episode: number; airing_at: string } =>
        Boolean(r.title_id),
      );

    if (rows.length) {
      const { error } = await db.from("airing_schedule").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`airing upsert failed: ${error.message}`);
      total += rows.length;
    }

    log(`  page ${page} · ${rows.length} episodes`);
    if (!data.Page.pageInfo.hasNextPage) break;
    page++;
  }

  // Drop schedule rows that have fallen out of the window we care about.
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  await db.from("airing_schedule").delete().lt("airing_at", cutoff);

  log(`airing done · ${total} episodes`);
}

/* -------------------------------------------------------------------------- */
/* Relation backfill                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Fetch AniList ids that are referenced by relations but missing from `titles`.
 * Run occasionally so franchise links (manga ↔ its anime adaptation) resolve.
 */
async function backfillRelations(maxBatches = 10) {
  log("backfilling relation targets…");

  const { data: allTitles } = await db.from("titles").select("id, anilist_id");
  const have = new Set((allTitles ?? []).map((t) => t.anilist_id));

  // Re-derive missing ids by re-reading relations we couldn't resolve earlier.
  // Cheapest path: ask AniList for the relations of titles we already have.
  const missing = new Set<number>();
  const sample = (allTitles ?? []).slice(0, maxBatches * 50);

  for (let i = 0; i < sample.length; i += 50) {
    const ids = sample.slice(i, i + 50).map((t) => t.anilist_id);
    const data = await anilistRequest<PageResponse>(BY_IDS_QUERY, { ids, page: 1 });
    for (const m of data.Page.media) {
      for (const e of extractRelations(m)) {
        if (!have.has(e.targetAnilistId)) missing.add(e.targetAnilistId);
      }
    }
    if (missing.size > 500) break;
  }

  log(`  ${missing.size} missing relation targets`);

  const ids = [...missing];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await anilistRequest<PageResponse>(BY_IDS_QUERY, {
      ids: ids.slice(i, i + 50),
      page: 1,
    });
    await upsertTitles(data.Page.media);
    log(`  fetched ${Math.min(i + 50, ids.length)}/${ids.length}`);
  }

  // Now that the targets exist, re-link everything we have.
  for (let i = 0; i < sample.length; i += 50) {
    const batch = sample.slice(i, i + 50).map((t) => t.anilist_id);
    const data = await anilistRequest<PageResponse>(BY_IDS_QUERY, { ids: batch, page: 1 });
    await upsertRelations(data.Page.media);
  }
}

/* -------------------------------------------------------------------------- */
/* Post-sync maintenance                                                      */
/* -------------------------------------------------------------------------- */

async function refreshFacets(client: SupabaseClient = db) {
  // The `facets` materialized view backs the Discover filter chips.
  const { error } = await client.rpc("refresh_facets" as never);
  if (error) {
    log(
      "note: could not refresh facets automatically — run this in the SQL editor:\n" +
        "      refresh materialized view concurrently public.facets;",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

async function main() {
  const mode = process.argv[2] ?? "refresh";
  const started = Date.now();

  log(`mode: ${mode}`);

  switch (mode) {
    case "seed":
      await seed();
      await syncSeason();
      await syncAiring();
      break;
    case "refresh":
      await syncSeason();
      await syncAiring();
      break;
    case "airing":
      await syncAiring();
      break;
    case "season":
      await syncSeason(process.argv[3], Number(process.argv[4]) || undefined);
      break;
    case "relations":
      await backfillRelations();
      break;
    default:
      console.error(`Unknown mode "${mode}". Use: seed | refresh | airing | season | relations`);
      process.exit(1);
  }

  await refreshFacets();

  const { count } = await db.from("titles").select("id", { count: "exact", head: true });
  log(
    `done in ${Math.round((Date.now() - started) / 1000)}s · ` +
      `${written} rows written · ${count ?? "?"} titles in catalog`,
  );
}

main().catch((err) => {
  console.error("\n[sync] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
