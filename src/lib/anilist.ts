/**
 * AniList GraphQL client + mappers.
 *
 * AniList is free and needs no API key. Rate limits (as of writing) are
 * 30 req/min for unauthenticated clients, and the API returns
 * `Retry-After` on 429. `anilistRequest` below honours both.
 *
 * Docs: https://docs.anilist.co/
 */

import type { AniListTag, MediaType } from "@/lib/types/database";

const ENDPOINT = "https://graphql.anilist.co";

/** Conservative spacing between requests: 30/min = one every 2s. */
const MIN_INTERVAL_MS = 2_100;
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AniListError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AniListError";
  }
}

export async function anilistRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  attempt = 0,
): Promise<T> {
  // Self-throttle so we never trip the rate limiter in the first place.
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? 60);
    if (attempt >= 4) throw new AniListError("Rate limited too many times", 429);
    console.warn(`[anilist] rate limited, waiting ${retryAfter}s…`);
    await sleep((retryAfter + 1) * 1000);
    return anilistRequest<T>(query, variables, attempt + 1);
  }

  if (res.status >= 500) {
    if (attempt >= 3) throw new AniListError(`AniList ${res.status}`, res.status);
    await sleep(2 ** attempt * 1500);
    return anilistRequest<T>(query, variables, attempt + 1);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new AniListError(json.errors.map((e) => e.message).join("; "), res.status);
  }
  if (!json.data) throw new AniListError("Empty AniList response", res.status);
  return json.data;
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

const MEDIA_FIELDS = /* GraphQL */ `
  id
  idMal
  type
  format
  countryOfOrigin
  source
  isAdult
  siteUrl
  title { romaji english native }
  synonyms
  description(asHtml: false)
  coverImage { medium large extraLarge color }
  bannerImage
  season
  seasonYear
  startDate { year month day }
  endDate { year month day }
  status
  episodes
  duration
  chapters
  volumes
  averageScore
  popularity
  favourites
  genres
  tags { name rank isMediaSpoiler }
  studios(isMain: true) { nodes { name } }
  staff(perPage: 4) { edges { role node { name { full } } } }
  nextAiringEpisode { episode airingAt }
  relations {
    edges {
      relationType
      node { id type format }
    }
  }
`;

/** Page of media, sorted however the caller asks. */
export const PAGE_QUERY = /* GraphQL */ `
  query Page($page: Int!, $perPage: Int!, $type: MediaType!, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage hasNextPage total }
      media(type: $type, sort: $sort, isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

/** Titles airing in a given season — used to keep "This Season" fresh. */
export const SEASON_QUERY = /* GraphQL */ `
  query Season($page: Int!, $perPage: Int!, $season: MediaSeason!, $seasonYear: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage hasNextPage }
      media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

/** Airing schedule window, for the calendar. */
export const AIRING_QUERY = /* GraphQL */ `
  query Airing($page: Int!, $start: Int!, $end: Int!) {
    Page(page: $page, perPage: 50) {
      pageInfo { currentPage hasNextPage }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
        id
        episode
        airingAt
        media { ${MEDIA_FIELDS} }
      }
    }
  }
`;

/** Fetch specific ids — used to backfill relation targets we don't have yet. */
export const BY_IDS_QUERY = /* GraphQL */ `
  query ByIds($ids: [Int!], $page: Int!) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      media(id_in: $ids) { ${MEDIA_FIELDS} }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Raw response shapes                                                        */
/* -------------------------------------------------------------------------- */

interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListMedia {
  id: number;
  idMal: number | null;
  type: "ANIME" | "MANGA";
  format: string | null;
  countryOfOrigin: string | null;
  source: string | null;
  isAdult: boolean;
  siteUrl: string | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  description: string | null;
  coverImage: {
    medium: string | null;
    large: string | null;
    extraLarge: string | null;
    color: string | null;
  } | null;
  bannerImage: string | null;
  season: string | null;
  seasonYear: number | null;
  startDate: FuzzyDate | null;
  endDate: FuzzyDate | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  chapters: number | null;
  volumes: number | null;
  averageScore: number | null;
  popularity: number | null;
  favourites: number | null;
  genres: string[];
  tags: { name: string; rank: number | null; isMediaSpoiler: boolean }[];
  studios: { nodes: { name: string }[] } | null;
  staff: { edges: { role: string | null; node: { name: { full: string } } }[] } | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  relations: {
    edges: {
      relationType: string;
      node: { id: number; type: string; format: string | null };
    }[];
  } | null;
}

export interface PageResponse {
  Page: {
    pageInfo: { currentPage: number; hasNextPage: boolean; total?: number };
    media: AniListMedia[];
  };
}

export interface AiringResponse {
  Page: {
    pageInfo: { currentPage: number; hasNextPage: boolean };
    airingSchedules: {
      id: number;
      episode: number;
      airingAt: number;
      media: AniListMedia;
    }[];
  };
}

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * AniList has no "light novel" media type — light novels are MANGA with
 * format NOVEL. We split them into their own media_type because the whole app
 * treats them as a first-class third category.
 */
export function toMediaType(media: AniListMedia): MediaType {
  if (media.type === "ANIME") return "anime";
  return media.format === "NOVEL" ? "light_novel" : "manga";
}

function fuzzyDateToISO(d: FuzzyDate | null): string | null {
  if (!d?.year) return null;
  const month = String(d.month ?? 1).padStart(2, "0");
  const day = String(d.day ?? 1).padStart(2, "0");
  return `${d.year}-${month}-${day}`;
}

/** Staff credits worth showing as "authors" for manga/LN. */
const AUTHOR_ROLES = /story|art|original creator|author|illustrat/i;

export function extractAuthors(media: AniListMedia): string[] {
  const edges = media.staff?.edges ?? [];
  const named = edges
    .filter((e) => !e.role || AUTHOR_ROLES.test(e.role))
    .map((e) => e.node.name.full);
  // Dedupe, cap at 4 — the UI only ever shows a couple.
  return [...new Set(named)].slice(0, 4);
}

export function mapTags(media: AniListMedia): AniListTag[] {
  return (media.tags ?? [])
    .filter((t) => (t.rank ?? 0) >= 40)
    .slice(0, 20)
    .map((t) => ({ name: t.name, rank: t.rank, isSpoiler: t.isMediaSpoiler }));
}

/** AniList media -> a row ready for `titles` upsert (minus the generated cols). */
export function mapMediaToTitleRow(media: AniListMedia) {
  const mediaType = toMediaType(media);

  return {
    anilist_id: media.id,
    mal_id: media.idMal,
    media_type: mediaType,
    format: media.format,
    title_romaji: media.title.romaji,
    title_english: media.title.english,
    title_native: media.title.native,
    synonyms: media.synonyms ?? [],
    synopsis: media.description,
    cover_image: media.coverImage?.medium ?? null,
    cover_image_large: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    cover_color: media.coverImage?.color ?? null,
    banner_image: media.bannerImage,
    season: media.season,
    season_year: media.seasonYear,
    start_date: fuzzyDateToISO(media.startDate),
    end_date: fuzzyDateToISO(media.endDate),
    status: media.status,
    episodes: media.episodes,
    duration: media.duration,
    chapters: media.chapters,
    // NOTE: AniList volume counts are frequently null or stale. We store what
    // it gives us purely as a display hint — user volume progress is always a
    // separate, manually-entered field (library_entries.progress_volumes).
    volumes: media.volumes,
    studios: media.studios?.nodes.map((n) => n.name) ?? [],
    authors: mediaType === "anime" ? [] : extractAuthors(media),
    genres: media.genres ?? [],
    tags: mapTags(media),
    average_score: media.averageScore,
    popularity: media.popularity,
    favourites: media.favourites,
    is_adult: media.isAdult ?? false,
    country_of_origin: media.countryOfOrigin,
    source: media.source,
    site_url: media.siteUrl,
    next_airing_at: media.nextAiringEpisode
      ? new Date(media.nextAiringEpisode.airingAt * 1000).toISOString()
      : null,
    next_airing_ep: media.nextAiringEpisode?.episode ?? null,
    synced_at: new Date().toISOString(),
  };
}

/** Relation edges worth persisting — skip character/other noise. */
const KEPT_RELATIONS = new Set([
  "ADAPTATION",
  "PREQUEL",
  "SEQUEL",
  "SIDE_STORY",
  "SPIN_OFF",
  "ALTERNATIVE",
  "PARENT",
  "SUMMARY",
]);

export function extractRelations(media: AniListMedia) {
  return (media.relations?.edges ?? [])
    .filter((e) => KEPT_RELATIONS.has(e.relationType))
    .map((e) => ({
      sourceAnilistId: media.id,
      targetAnilistId: e.node.id,
      relationType: e.relationType,
    }));
}
