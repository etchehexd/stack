import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  MediaType,
  SearchResult,
  Title,
} from "@/lib/types/database";
import { currentSeason } from "@/lib/utils";

/** Columns every card needs. Keeping this in one place stops query drift. */
export const CARD_COLUMNS =
  "id, media_type, format, title_english, title_romaji, cover_image_large, " +
  "cover_color, average_score, season_year, episodes, chapters, genres, popularity";

export type CardTitle = Pick<
  Title,
  | "id"
  | "media_type"
  | "format"
  | "title_english"
  | "title_romaji"
  | "cover_image_large"
  | "cover_color"
  | "average_score"
  | "season_year"
  | "episodes"
  | "chapters"
  | "genres"
  | "popularity"
>;

/* -------------------------------------------------------------------------- */
/* Home page shelves                                                          */
/* -------------------------------------------------------------------------- */

export type Shelf = "popular" | "top_rated" | "trending";

export async function getShelf(
  mediaType: MediaType,
  shelf: Shelf,
  limit = 12,
): Promise<CardTitle[]> {
  const supabase = await createClient();

  let query = supabase
    .from("titles")
    .select(CARD_COLUMNS)
    .eq("media_type", mediaType)
    .eq("is_adult", false)
    .limit(limit);

  if (shelf === "popular") {
    query = query.order("popularity", { ascending: false, nullsFirst: false });
  } else if (shelf === "top_rated") {
    // Guard against a 1-vote 100% score dominating the shelf.
    query = query
      .gte("popularity", 5000)
      .order("average_score", { ascending: false, nullsFirst: false });
  } else {
    // "Trending" proxy: recent + popular. AniList's own trending score isn't
    // stable enough between syncs to store meaningfully.
    query = query
      .gte("season_year", new Date().getFullYear() - 1)
      .order("popularity", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[getShelf ${mediaType}/${shelf}]`, error.message);
    return [];
  }
  // CARD_COLUMNS is a runtime constant, so supabase-js can't infer the shape.
  return (data ?? []) as unknown as CardTitle[];
}

/** Anime airing in the current season, most popular first. */
export async function getThisSeason(limit = 18): Promise<CardTitle[]> {
  const supabase = await createClient();
  const { season, year } = currentSeason();

  const { data, error } = await supabase
    .from("titles")
    .select(CARD_COLUMNS)
    .eq("media_type", "anime")
    .eq("season", season)
    .eq("season_year", year)
    .eq("is_adult", false)
    .order("popularity", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("[getThisSeason]", error.message);
    return [];
  }
  // CARD_COLUMNS is a runtime constant, so supabase-js can't infer the shape.
  return (data ?? []) as unknown as CardTitle[];
}

/* -------------------------------------------------------------------------- */
/* Discover                                                                   */
/* -------------------------------------------------------------------------- */

export interface DiscoverParams {
  query?: string;
  mediaTypes?: MediaType[];
  formats?: string[];
  excludeFormats?: string[];
  statuses?: string[];
  excludeStatuses?: string[];
  includeGenres?: string[];
  excludeGenres?: string[];
  includeStudios?: string[];
  excludeStudios?: string[];
  yearMin?: number;
  yearMax?: number;
  season?: string;
  countMin?: number;
  countMax?: number;
  scoreMin?: number;
  scoreMax?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}

export async function searchTitles(params: DiscoverParams): Promise<{
  results: SearchResult[];
  total: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_titles", {
    p_query: params.query?.trim() || null,
    p_media_types: params.mediaTypes?.length ? params.mediaTypes : null,
    p_formats: params.formats?.length ? params.formats : null,
    p_exclude_formats: params.excludeFormats?.length ? params.excludeFormats : null,
    p_statuses: params.statuses?.length ? params.statuses : null,
    p_exclude_statuses: params.excludeStatuses?.length ? params.excludeStatuses : null,
    p_include_genres: params.includeGenres?.length ? params.includeGenres : null,
    p_exclude_genres: params.excludeGenres?.length ? params.excludeGenres : null,
    p_include_studios: params.includeStudios?.length ? params.includeStudios : null,
    p_exclude_studios: params.excludeStudios?.length ? params.excludeStudios : null,
    p_year_min: params.yearMin ?? null,
    p_year_max: params.yearMax ?? null,
    p_season: params.season ?? null,
    p_count_min: params.countMin ?? null,
    p_count_max: params.countMax ?? null,
    p_score_min: params.scoreMin ?? null,
    p_score_max: params.scoreMax ?? null,
    p_include_adult: false,
    p_sort: params.sort ?? "popularity",
    p_limit: params.limit ?? 40,
    p_offset: params.offset ?? 0,
  });

  if (error) {
    console.error("[searchTitles]", error.message);
    return { results: [], total: 0 };
  }

  const results = (data ?? []) as SearchResult[];
  // total_count is repeated on every row by the RPC's cross join.
  return { results, total: Number(results[0]?.total_count ?? 0) };
}

/** Filter chip options, from the `facets` materialized view. */
export async function getFacets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facets")
    .select("kind, value, n")
    .order("n", { ascending: false });

  if (error) {
    console.error("[getFacets]", error.message);
    return { genres: [], studios: [], authors: [], formats: [] };
  }

  const rows = data ?? [];
  const pick = (kind: string) =>
    rows.filter((r) => r.kind === kind).map((r) => ({ value: r.value, count: Number(r.n) }));

  return {
    genres: pick("genre"),
    studios: pick("studio").slice(0, 60),
    authors: pick("author").slice(0, 60),
    formats: pick("format"),
  };
}

/* -------------------------------------------------------------------------- */
/* Title detail                                                               */
/* -------------------------------------------------------------------------- */

export async function getTitle(id: string): Promise<Title | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getTitle]", error.message);
    return null;
  }
  return data as Title | null;
}

export interface RelatedTitle extends CardTitle {
  relation_type: string;
}

export async function getRelations(titleId: string): Promise<RelatedTitle[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("title_relations")
    .select(`relation_type, target:titles!title_relations_target_id_fkey(${CARD_COLUMNS})`)
    .eq("source_id", titleId);

  if (error) {
    console.error("[getRelations]", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => {
      const target = row.target as unknown as CardTitle | null;
      return target ? { ...target, relation_type: row.relation_type } : null;
    })
    .filter((r): r is RelatedTitle => r !== null);
}

/** Every rating of a title, for the community distribution scatter. */
export async function getTitleRatings(titleId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ratings")
    .select("user_id, enjoyment, craft")
    .eq("title_id", titleId)
    .not("enjoyment", "is", null)
    .not("craft", "is", null)
    .limit(500);

  if (error) {
    console.error("[getTitleRatings]", error.message);
    return [];
  }
  return data ?? [];
}

/** The viewer's own rating + library entry for a title. */
export async function getUserTitleState(titleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rating: null, entry: null, isFavorite: false };

  const [ratingRes, entryRes, favRes] = await Promise.all([
    supabase
      .from("ratings")
      .select("enjoyment, craft")
      .eq("user_id", user.id)
      .eq("title_id", titleId)
      .maybeSingle(),
    supabase
      .from("library_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("title_id", titleId)
      .maybeSingle(),
    supabase
      .from("favorites")
      .select("title_id")
      .eq("user_id", user.id)
      .eq("title_id", titleId)
      .maybeSingle(),
  ]);

  return {
    rating: ratingRes.data,
    entry: entryRes.data,
    isFavorite: Boolean(favRes.data),
  };
}

/** The viewer's ratings, as faint context dots behind the live rating pad. */
export async function getMyRatingPoints(limit = 200) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("ratings")
    .select("title_id, enjoyment, craft")
    .eq("user_id", user.id)
    .not("enjoyment", "is", null)
    .not("craft", "is", null)
    .limit(limit);

  return data ?? [];
}

/* -------------------------------------------------------------------------- */
/* Library                                                                    */
/* -------------------------------------------------------------------------- */

export interface LibraryRow {
  title_id: string;
  status: string;
  progress: number;
  progress_volumes: number | null;
  repeat_count: number;
  updated_at: string;
  notes: string | null;
  titles: CardTitle & { volumes: number | null; status: string | null };
}

export async function getLibrary(userId: string, mediaType: MediaType) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("library_entries")
    .select(
      `title_id, status, progress, progress_volumes, repeat_count, updated_at, notes,
       titles!inner(${CARD_COLUMNS}, volumes, status)`,
    )
    .eq("user_id", userId)
    .eq("titles.media_type", mediaType)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[getLibrary]", error.message);
    return [];
  }
  return (data ?? []) as unknown as LibraryRow[];
}

export async function getRatingsMap(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ratings")
    .select("title_id, enjoyment, craft")
    .eq("user_id", userId);

  return new Map(
    (data ?? []).map((r) => [r.title_id, { enjoyment: r.enjoyment, craft: r.craft }]),
  );
}

/* -------------------------------------------------------------------------- */
/* Calendar                                                                   */
/* -------------------------------------------------------------------------- */

export interface AiringRow {
  id: number;
  episode: number;
  airing_at: string;
  titles: CardTitle;
}

export async function getAiringWindow(from: Date, to: Date): Promise<AiringRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("airing_schedule")
    .select(`id, episode, airing_at, titles!inner(${CARD_COLUMNS})`)
    .gte("airing_at", from.toISOString())
    .lte("airing_at", to.toISOString())
    .order("airing_at", { ascending: true });

  if (error) {
    console.error("[getAiringWindow]", error.message);
    return [];
  }
  return (data ?? []) as unknown as AiringRow[];
}

/**
 * A rolling 7-day airing window starting at local midnight today.
 *
 * The clock is read here, in the data layer, rather than inside the page
 * component — so every row on the page is measured against one instant and
 * rendering stays a pure function of its inputs.
 */
export async function getAiringWeek() {
  const now = Date.now();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);

  return { now, from, to, rows: await getAiringWindow(from, to) };
}

/** Title ids the viewer is currently watching — used to highlight the calendar. */
export async function getTrackedTitleIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("library_entries")
    .select("title_id")
    .eq("user_id", user.id)
    .in("status", ["watching", "planning", "repeating"]);

  return new Set((data ?? []).map((r) => r.title_id));
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export async function getProfileByUsername(username: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  return data;
}

export async function getUserStats(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("user_stats", { p_user_id: userId });
  if (error) {
    console.error("[getUserStats]", error.message);
    return null;
  }
  return data;
}

/** All of a user's rated titles, for the profile scatter. */
export async function getRatingScatter(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ratings")
    .select(
      `enjoyment, craft,
       titles!inner(id, media_type, title_english, title_romaji, cover_image_large)`,
    )
    .eq("user_id", userId)
    .not("enjoyment", "is", null)
    .not("craft", "is", null)
    .limit(1000);

  if (error) {
    console.error("[getRatingScatter]", error.message);
    return [];
  }

  return (data ?? []) as unknown as {
    enjoyment: number;
    craft: number;
    titles: {
      id: string;
      media_type: MediaType;
      title_english: string | null;
      title_romaji: string | null;
      cover_image_large: string | null;
    };
  }[];
}

export async function getFavorites(userId: string): Promise<CardTitle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select(`position, titles!inner(${CARD_COLUMNS})`)
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .limit(12);

  if (error) {
    console.error("[getFavorites]", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.titles as unknown as CardTitle);
}

export interface ActivityItem {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
  titles: {
    id: string;
    title_english: string | null;
    title_romaji: string | null;
    cover_image_large: string | null;
    media_type: MediaType;
  } | null;
}

export async function getActivity(userId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity")
    .select(
      `id, kind, payload, created_at,
       titles(id, title_english, title_romaji, cover_image_large, media_type)`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getActivity]", error.message);
    return [];
  }
  return (data ?? []) as unknown as ActivityItem[];
}

export async function getRecommendations(userId: string, limit = 12) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recommendations", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) {
    console.error("[getRecommendations]", error.message);
    return [];
  }
  return data ?? [];
}
