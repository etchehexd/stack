"use server";

import { z } from "zod";

import { searchTitles } from "@/lib/queries";
import type { SearchResult } from "@/lib/types/database";

/**
 * One more page of results for the infinite grid.
 *
 * The client holds the filter state it was rendered with and asks for the next
 * slice; everything is re-validated here because a server action is a public
 * endpoint no matter who is supposed to be calling it.
 */
const list = z.array(z.string().min(1).max(80)).max(40).optional();

const schema = z.object({
  query: z.string().max(200).optional(),
  mediaTypes: z.array(z.enum(["anime", "manga", "light_novel"])).max(3).optional(),
  formats: list,
  excludeFormats: list,
  statuses: list,
  excludeStatuses: list,
  includeGenres: list,
  excludeGenres: list,
  includeStudios: list,
  excludeStudios: list,
  yearMin: z.number().int().min(1900).max(2200).optional(),
  yearMax: z.number().int().min(1900).max(2200).optional(),
  season: z.string().max(20).optional(),
  countMin: z.number().int().min(0).max(100_000).optional(),
  countMax: z.number().int().min(0).max(100_000).optional(),
  scoreMin: z.number().int().min(0).max(100).optional(),
  scoreMax: z.number().int().min(0).max(100).optional(),
  sort: z.string().max(30).optional(),
  /** Where the client has got to. Capped so this can't be walked forever. */
  offset: z.number().int().min(0).max(4000),
  limit: z.number().int().min(1).max(60),
});

export type LoadMoreInput = z.infer<typeof schema>;

export async function loadMoreTitles(
  input: LoadMoreInput,
): Promise<{ ok: true; results: SearchResult[]; total: number } | { ok: false }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const { results, total } = await searchTitles(parsed.data);
  return { ok: true, results, total };
}
