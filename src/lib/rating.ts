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
/* Scatter geometry — shared by the compact pad and the full profile chart     */
/* -------------------------------------------------------------------------- */

/**
 * Map a rating to a 0–1 position inside the plot area.
 * x = enjoyment (left→right), y = craft (bottom→top, so we invert for SVG).
 */
export function toPlotPosition(enjoyment: number, craft: number) {
  const span = RATING_MAX - RATING_MIN; // 4.5
  return {
    x: (enjoyment - RATING_MIN) / span,
    y: 1 - (craft - RATING_MIN) / span,
  };
}

/** Inverse of toPlotPosition, snapped back onto the half-star grid. */
export function fromPlotPosition(x: number, y: number) {
  const span = RATING_MAX - RATING_MIN;
  return {
    enjoyment: snapToStep(RATING_MIN + x * span),
    craft: snapToStep(RATING_MIN + (1 - y) * span),
  };
}
