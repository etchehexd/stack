import { NextResponse, type NextRequest } from "next/server";

import {
  AIRING_QUERY,
  SEASON_QUERY,
  anilistRequest,
  mapMediaToTitleRow,
  type AiringResponse,
  type PageResponse,
} from "@/lib/anilist";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentSeason } from "@/lib/utils";

/**
 * Scheduled catalog refresh: current season + the next two weeks of airings.
 *
 * Deliberately much lighter than `npm run sync:seed` so it finishes inside a
 * serverless timeout. Seeding the full catalog is a one-off you run locally.
 *
 * Protect with a shared secret (CRON_SECRET) — Vercel Cron sends it as
 * `Authorization: Bearer <CRON_SECRET>`.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { season, year } = currentSeason();
  let titlesWritten = 0;
  let episodesWritten = 0;

  try {
    // --- current season -----------------------------------------------------
    for (let page = 1; page <= 3; page++) {
      const data = await anilistRequest<PageResponse>(SEASON_QUERY, {
        page,
        perPage: 50,
        season,
        seasonYear: year,
      });
      const rows = data.Page.media.map(mapMediaToTitleRow);
      if (rows.length) {
        const { error } = await db.from("titles").upsert(rows, { onConflict: "anilist_id" });
        if (error) throw new Error(error.message);
        titlesWritten += rows.length;
      }
      if (!data.Page.pageInfo.hasNextPage) break;
    }

    // --- airing schedule ----------------------------------------------------
    const start = Math.floor(Date.now() / 1000) - 2 * 86_400;
    const end = Math.floor(Date.now() / 1000) + 14 * 86_400;

    for (let page = 1; page <= 8; page++) {
      const data = await anilistRequest<AiringResponse>(AIRING_QUERY, { page, start, end });
      const schedules = data.Page.airingSchedules;
      if (!schedules.length) break;

      const { data: upserted, error: titleErr } = await db
        .from("titles")
        .upsert(schedules.map((s) => mapMediaToTitleRow(s.media)), {
          onConflict: "anilist_id",
        })
        .select("id, anilist_id");
      if (titleErr) throw new Error(titleErr.message);

      const idMap = new Map((upserted ?? []).map((t) => [t.anilist_id, t.id]));
      const rows = schedules
        .map((s) => ({
          id: s.id,
          title_id: idMap.get(s.media.id)!,
          episode: s.episode,
          airing_at: new Date(s.airingAt * 1000).toISOString(),
        }))
        .filter((r) => Boolean(r.title_id));

      if (rows.length) {
        const { error } = await db.from("airing_schedule").upsert(rows, { onConflict: "id" });
        if (error) throw new Error(error.message);
        episodesWritten += rows.length;
      }
      if (!data.Page.pageInfo.hasNextPage) break;
    }

    // --- housekeeping -------------------------------------------------------
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await db.from("airing_schedule").delete().lt("airing_at", cutoff);
    await db.rpc("refresh_facets" as never);

    return NextResponse.json({
      ok: true,
      season: `${season} ${year}`,
      titlesWritten,
      episodesWritten,
    });
  } catch (err) {
    console.error("[cron/sync]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 },
    );
  }
}
