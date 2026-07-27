/**
 * The rating system.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A score is NOT a number you choose. It is a position in your own ordered
 * list, expressed as a 0–10 figure.
 *
 * Asking someone "is this a 7.4 or a 7.8" is a question nobody can answer
 * consistently — the same show gets a different number depending on your mood
 * and what you watched last. Asking "did you like this more than that one" is
 * a question everybody can answer instantly and answers the same way twice.
 * So that is the only question this app asks.
 *
 * How a rating happens:
 *
 *   1. You pick one of three buckets — loved / fine / bad.
 *   2. The app binary-searches that bucket, showing you one already-rated
 *      title at a time: "which did you prefer?". About log2(n) questions, so
 *      five taps places a title among thirty.
 *   3. Everything in the bucket is respread evenly across the bucket's slice
 *      of the 0–10 scale. Your scores shift as your list grows. That is
 *      correct: a 9.1 means "ninth-best thing I've seen", and that changes.
 *
 * Before you have SEED_TARGET ratings there is nothing to compare against, so
 * those first few are typed in directly and keep the exact number you gave.
 * The first comparison in a bucket takes them relative too.
 *
 * The server owns all of this — see place_rating() / seed_rating() /
 * respread_bucket() in supabase/schema.sql. This file is the client's copy of
 * the constants plus the binary-search driver.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SCORE_MIN = 0.1;
export const SCORE_MAX = 10.0;

/** Direct-entry ratings required before comparison unlocks. */
export const SEED_TARGET = 10;

/**
 * Hard ceiling on questions per placement. log2 of a big bucket is 8–9, which
 * is more taps than anyone will tolerate; at the cap we stop and take the
 * midpoint of whatever range is left. Being one or two places off in a list of
 * three hundred moves the score by less than a tenth.
 */
export const MAX_COMPARISONS = 7;

export type Bucket = "loved" | "fine" | "bad";

export interface BucketMeta {
  key: Bucket;
  /** The word on the button. */
  label: string;
  /** What picking it commits you to, in one short line. */
  blurb: string;
  color: string;
  /** [lo, hi] — must match bucket_band() in schema.sql. */
  band: [number, number];
}

export const BUCKETS: Record<Bucket, BucketMeta> = {
  loved: {
    key: "loved",
    label: "Loved it",
    blurb: "Would recommend without hedging",
    color: "oklch(0.78 0.16 152)",
    band: [6.8, 10.0],
  },
  fine: {
    key: "fine",
    label: "It was fine",
    blurb: "Glad I watched it, no strong feelings",
    color: "oklch(0.82 0.15 85)",
    band: [3.4, 6.7],
  },
  bad: {
    key: "bad",
    label: "Didn't like it",
    blurb: "Wouldn't put anyone else through it",
    color: "oklch(0.68 0.16 25)",
    band: [0.1, 3.3],
  },
};

/** Buckets in the order they're offered: best first. */
export const BUCKET_ORDER: Bucket[] = ["loved", "fine", "bad"];

export function bucketOf(score: number | null | undefined): Bucket | null {
  if (score == null) return null;
  if (score >= BUCKETS.loved.band[0]) return "loved";
  if (score >= BUCKETS.fine.band[0]) return "fine";
  return "bad";
}

/** 8.4 → "8.4". Null-safe. */
export function formatScore(score: number | null | undefined): string {
  if (score == null) return "—";
  return Number(score).toFixed(1);
}

/** AniList stores a 0–100 percentage; every score on screen is 0–10. */
export function percentToTen(percent: number | null | undefined): number | null {
  if (percent == null) return null;
  return Math.round(percent) / 10;
}

export function formatPercentAsTen(percent: number | null | undefined): string {
  const ten = percentToTen(percent);
  return ten == null ? "—" : ten.toFixed(1);
}

/** The colour a score is drawn in. Three bands, so 9.1 and 9.4 always match. */
export function scoreColor(score: number | null | undefined): string {
  const bucket = bucketOf(score);
  return bucket ? BUCKETS[bucket].color : "var(--text-tertiary)";
}

/* -------------------------------------------------------------------------- */
/* Binary insertion                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A placement in progress.
 *
 * `lo` and `hi` bracket the insert position in a list held in ASCENDING order
 * (index 0 = the worst thing in the bucket). When they meet, `lo` is the
 * answer and it is exactly the `p_position` that place_rating() wants.
 */
export interface Placement {
  lo: number;
  hi: number;
  asked: number;
}

export function startPlacement(bucketSize: number): Placement {
  return { lo: 0, hi: bucketSize, asked: 0 };
}

export function placementDone(p: Placement): boolean {
  return p.lo >= p.hi || p.asked >= MAX_COMPARISONS;
}

/** Index of the already-rated title to show next. Only valid while not done. */
export function pivotIndex(p: Placement): number {
  return Math.floor((p.lo + p.hi) / 2);
}

/**
 * Record an answer. `preferredNew` is true when the user picked the title
 * being rated over the one at the pivot.
 */
export function advance(p: Placement, preferredNew: boolean): Placement {
  const mid = pivotIndex(p);
  return preferredNew
    ? { lo: mid + 1, hi: p.hi, asked: p.asked + 1 }
    : { lo: p.lo, hi: mid, asked: p.asked + 1 };
}

/** Where the title ends up. Safe to call at any point. */
export function placementResult(p: Placement): number {
  return p.lo >= p.hi ? p.lo : Math.floor((p.lo + p.hi) / 2);
}

/**
 * Upper bound on remaining questions, for the progress dots. Deliberately an
 * estimate — the real count can come in lower when the range collapses early.
 */
export function questionsRemaining(p: Placement): number {
  if (placementDone(p)) return 0;
  const span = p.hi - p.lo;
  return Math.min(
    MAX_COMPARISONS - p.asked,
    Math.max(1, Math.ceil(Math.log2(span + 1))),
  );
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

export type LibrarySortKey = "updated" | "title" | "progress" | "score";

export const LIBRARY_SORTS: { key: LibrarySortKey; label: string }[] = [
  { key: "updated", label: "Recently updated" },
  { key: "score", label: "Highest rated" },
  { key: "title", label: "A–Z" },
  { key: "progress", label: "Progress" },
];
