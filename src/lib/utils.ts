import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LibraryStatus, MediaType, Title } from "@/lib/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Media type presentation                                                    */
/* -------------------------------------------------------------------------- */

export const MEDIA_TYPES: MediaType[] = ["anime", "manga", "light_novel"];

export const MEDIA_LABEL: Record<MediaType, string> = {
  anime: "Anime",
  manga: "Manga",
  light_novel: "Light Novels",
};

export const MEDIA_LABEL_SINGULAR: Record<MediaType, string> = {
  anime: "Anime",
  manga: "Manga",
  light_novel: "Light Novel",
};

/** CSS custom property holding this media type's accent colour. */
export function mediaAccent(type: MediaType): string {
  return type === "anime"
    ? "var(--color-anime)"
    : type === "manga"
      ? "var(--color-manga)"
      : "var(--color-ln)";
}

/** Anime is "watched", everything else is "read". */
export function isReadable(type: MediaType) {
  return type !== "anime";
}

export const STATUS_LABEL: Record<
  LibraryStatus,
  { watch: string; read: string }
> = {
  watching: { watch: "Watching", read: "Reading" },
  completed: { watch: "Completed", read: "Completed" },
  planning: { watch: "Planning", read: "Planning" },
  on_hold: { watch: "On Hold", read: "On Hold" },
  dropped: { watch: "Dropped", read: "Dropped" },
  repeating: { watch: "Rewatching", read: "Rereading" },
};

export function statusLabel(status: LibraryStatus, type: MediaType) {
  return isReadable(type)
    ? STATUS_LABEL[status].read
    : STATUS_LABEL[status].watch;
}

export const LIBRARY_STATUSES: LibraryStatus[] = [
  "watching",
  "completed",
  "planning",
  "on_hold",
  "dropped",
  "repeating",
];

/* -------------------------------------------------------------------------- */
/* Titles                                                                     */
/* -------------------------------------------------------------------------- */

type TitleNames = Pick<Title, "title_english" | "title_romaji"> &
  Partial<Pick<Title, "title_native">>;

/**
 * DECISION: English title preferred, falling back to romaji then native.
 * Flip the order here to make romaji the default everywhere.
 */
export function displayTitle(t: TitleNames): string {
  return t.title_english || t.title_romaji || t.title_native || "Untitled";
}

/** The romaji title, but only when it differs from what we already show. */
export function secondaryTitle(t: TitleNames): string | null {
  const primary = displayTitle(t);
  return t.title_romaji && t.title_romaji !== primary ? t.title_romaji : null;
}

const FORMAT_LABEL: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
  MANGA: "Manga",
  NOVEL: "Light Novel",
  ONE_SHOT: "One-shot",
};

export function formatLabel(format: string | null): string {
  if (!format) return "—";
  return FORMAT_LABEL[format] ?? titleCase(format);
}

const STATUS_TEXT: Record<string, string> = {
  FINISHED: "Finished",
  RELEASING: "Releasing",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
};

export function airingStatusLabel(status: string | null): string {
  if (!status) return "Unknown";
  return STATUS_TEXT[status] ?? titleCase(status);
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Total units for a title: episodes for anime, chapters otherwise. */
export function totalUnits(t: Pick<Title, "media_type" | "episodes" | "chapters">) {
  return t.media_type === "anime" ? t.episodes : t.chapters;
}

export function unitNoun(type: MediaType, plural = false) {
  const noun = type === "anime" ? "episode" : "chapter";
  return plural ? `${noun}s` : noun;
}

/** AniList synopses contain a little HTML; strip it for previews. */
export function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Seasons                                                                    */
/* -------------------------------------------------------------------------- */

export const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
export type Season = (typeof SEASONS)[number];

export function currentSeason(date = new Date()): { season: Season; year: number } {
  const m = date.getUTCMonth(); // 0-11
  const year = date.getUTCFullYear();
  if (m <= 1 || m === 11) {
    // Dec belongs to the *next* year's Winter season, per AniList convention.
    return { season: "WINTER", year: m === 11 ? year + 1 : year };
  }
  if (m <= 4) return { season: "SPRING", year };
  if (m <= 7) return { season: "SUMMER", year };
  return { season: "FALL", year };
}

/* -------------------------------------------------------------------------- */
/* Numbers & time                                                             */
/* -------------------------------------------------------------------------- */

export function compactNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function relativeTime(iso: string | Date): string {
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - then.getTime();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(-Math.round(diff / ms), unit);
  }
  return "just now";
}

/**
 * "2d 4h" — used by the calendar countdown. Pass `now` when rendering a list,
 * so every row is measured against the same instant.
 */
export function countdown(target: string | Date, now = Date.now()): string {
  const ms = (typeof target === "string" ? new Date(target) : target).getTime() - now;
  if (ms <= 0) return "aired";
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
