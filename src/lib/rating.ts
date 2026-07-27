/**
 * The two-axis rating system.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANT: Enjoyment and Craft are independent. Nothing in this app collapses
 * them into a single score except `overallScore()` below, which is:
 *   - opt-in (profiles.preferences.overall_sort_enabled, default false)
 *   - used ONLY for sorting, never for display next to a title
 *   - deliberately isolated in this file so it can be reweighted or deleted
 *     without touching anything else. Change ONLY `overallScore` to reweight.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const RATING_MIN = 0.5;
export const RATING_MAX = 5.0;
export const RATING_STEP = 0.5;
export const STAR_COUNT = 5;

/** The midpoint that divides the quadrants. Titles at exactly 3.5 read as "high". */
export const QUADRANT_PIVOT = 3.5;

export type Axis = "enjoyment" | "craft";

export const AXIS_META: Record<
  Axis,
  { label: string; blurb: string; color: string }
> = {
  enjoyment: {
    label: "Enjoyment",
    blurb: "How much you personally liked it",
    color: "var(--color-enjoyment)",
  },
  craft: {
    label: "Craft",
    blurb: "How well-made it is — writing, art, pacing, direction",
    color: "var(--color-craft)",
  },
};

/** Snap any raw value onto the legal 0.5-step grid, clamped to [0.5, 5]. */
export function snapToStep(value: number): number {
  const snapped = Math.round(value / RATING_STEP) * RATING_STEP;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Number(snapped.toFixed(1))));
}

export function isValidRating(value: number | null | undefined): boolean {
  if (value == null) return false;
  return (
    value >= RATING_MIN && value <= RATING_MAX && Math.abs(value * 2 - Math.round(value * 2)) < 1e-9
  );
}

/** 4.5 -> "4½", 4.0 -> "4". Used where space is tight. */
export function prettyStars(value: number | null): string {
  if (value == null) return "–";
  const whole = Math.floor(value);
  const half = value % 1 !== 0;
  if (whole === 0) return "½";
  return half ? `${whole}½` : `${whole}`;
}

/** Star rating -> the 1–10 scale people are used to quoting. */
export function toTenScale(value: number | null): number | null {
  return value == null ? null : value * 2;
}

/* -------------------------------------------------------------------------- */
/* Quadrants                                                                  */
/* -------------------------------------------------------------------------- */

export type QuadrantKey = "favorites" | "guilty" | "respected" | "notforyou";

export interface QuadrantMeta {
  key: QuadrantKey;
  label: string;
  description: string;
  /** Where the quadrant sits on the grid, for tinting the scatter background. */
  corner: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  color: string;
}

export const QUADRANTS: Record<QuadrantKey, QuadrantMeta> = {
  favorites: {
    key: "favorites",
    label: "All-time favorites",
    description: "Loved them, and they earned it.",
    corner: "top-right",
    color: "oklch(0.78 0.16 145)",
  },
  guilty: {
    key: "guilty",
    label: "Guilty pleasures",
    description: "Not a masterpiece. Don't care.",
    corner: "bottom-right",
    color: "var(--color-enjoyment)",
  },
  respected: {
    key: "respected",
    label: "Respected, not for me",
    description: "Undeniably well-made. Just didn't land.",
    corner: "top-left",
    color: "var(--color-craft)",
  },
  notforyou: {
    key: "notforyou",
    label: "Not for you",
    description: "Didn't work on either axis.",
    corner: "bottom-left",
    color: "oklch(0.6 0.05 280)",
  },
};

/** X axis = enjoyment, Y axis = craft. */
export function quadrantOf(
  enjoyment: number | null,
  craft: number | null,
): QuadrantMeta | null {
  if (enjoyment == null || craft == null) return null;
  const highE = enjoyment >= QUADRANT_PIVOT;
  const highC = craft >= QUADRANT_PIVOT;
  if (highE && highC) return QUADRANTS.favorites;
  if (highE && !highC) return QUADRANTS.guilty;
  if (!highE && highC) return QUADRANTS.respected;
  return QUADRANTS.notforyou;
}

/* -------------------------------------------------------------------------- */
/* Optional composite score — the ONLY place the two axes are blended          */
/* -------------------------------------------------------------------------- */

/**
 * Even 50/50 average of Enjoyment and Craft.
 *
 * To reweight (e.g. 60% enjoyment), change ONLY these two constants. To remove
 * the feature entirely, delete this function and the "Overall" entry from
 * SORT_OPTIONS below — nothing else depends on it.
 */
export const OVERALL_WEIGHT_ENJOYMENT = 0.5;
export const OVERALL_WEIGHT_CRAFT = 0.5;

export function overallScore(
  enjoyment: number | null,
  craft: number | null,
): number | null {
  if (enjoyment == null && craft == null) return null;
  // If only one axis is set, that axis *is* the overall score.
  if (enjoyment == null) return craft;
  if (craft == null) return enjoyment;
  return (
    enjoyment * OVERALL_WEIGHT_ENJOYMENT + craft * OVERALL_WEIGHT_CRAFT
  );
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

export type RatingSortKey = "enjoyment" | "craft" | "overall";

export interface SortOption {
  key: RatingSortKey;
  label: string;
  /** "Overall" is hidden unless the user opted in. */
  requiresOptIn?: boolean;
}

export const SORT_OPTIONS: SortOption[] = [
  { key: "enjoyment", label: "Enjoyment" },
  { key: "craft", label: "Craft" },
  { key: "overall", label: "Overall", requiresOptIn: true },
];

export function ratingSortValue(
  key: RatingSortKey,
  enjoyment: number | null,
  craft: number | null,
): number | null {
  if (key === "enjoyment") return enjoyment;
  if (key === "craft") return craft;
  return overallScore(enjoyment, craft);
}

/* -------------------------------------------------------------------------- */
/* Display scale                                                              */
/* -------------------------------------------------------------------------- */

/**
 * EVERY score shown anywhere in this app is on a 0–10 scale with one decimal.
 *
 * There are two sources feeding it and they used to be displayed in their own
 * native units, which meant a card could show "84" from AniList next to "4½"
 * from the user and expect people to hold two scales in their head:
 *
 *   - the user's own axes are stored as 0.5–5.0 half-stars (the star row is
 *     still the input, because clicking five glyphs is faster than typing a
 *     decimal) → doubled for display
 *   - AniList's community average is stored as an integer percentage → tenthed
 *
 * Format through these two functions and nowhere else.
 */

/** Star-scale value (0.5–5) → "9.0". Null-safe; returns a dash. */
export function formatTen(value: number | null | undefined): string {
  if (value == null) return "—";
  return (value * 2).toFixed(1);
}

/** AniList percentage (0–100) → 8.4. Null-safe. */
export function percentToTen(percent: number | null | undefined): number | null {
  if (percent == null) return null;
  return Math.round(percent) / 10;
}

/** AniList percentage (0–100) → "8.4". Null-safe; returns a dash. */
export function formatPercentAsTen(percent: number | null | undefined): string {
  const ten = percentToTen(percent);
  return ten == null ? "—" : ten.toFixed(1);
}

/**
 * Where a 0–10 score sits, for colouring it. Deliberately coarse: three bands,
 * not a continuous ramp, so the same score is always the same colour.
 */
export function scoreBand(ten: number | null): "high" | "mid" | "low" | null {
  if (ten == null) return null;
  if (ten >= 8) return "high";
  if (ten >= 6.5) return "mid";
  return "low";
}

export const BAND_COLOR: Record<"high" | "mid" | "low", string> = {
  high: "oklch(0.78 0.16 152)",
  mid: "oklch(0.82 0.15 85)",
  low: "oklch(0.68 0.15 25)",
};
