import {
  formatPercentAsTen,
  formatScore,
  percentToTen,
  scoreColor,
} from "@/lib/rating";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

/**
 * Geometry, in the SVG's own 36-unit box so every size scales identically.
 * `r` leaves room for the stroke; `C` is the circumference the arc is cut from.
 */
const R = 15.4;
const C = 2 * Math.PI * R;

const SIZE: Record<Size, { box: string; text: string; stroke: number }> = {
  sm: { box: "size-7", text: "text-[10px]", stroke: 3.2 },
  md: { box: "size-[2.15rem]", text: "text-[12.5px]", stroke: 3.4 },
  lg: { box: "size-16", text: "text-xl", stroke: 3 },
};

/**
 * A score, drawn as a dial.
 *
 * It sits on the TOP RIGHT of cover art, where nothing else ever goes, and it
 * has to survive being dropped on any artwork at all — so it's a self-contained
 * medallion: a dark glass disc, a track ring, and an arc filled to the score.
 * The arc is the point. You read "how good" from how far round it goes before
 * you read the figure, which is what makes a wall of posters scannable at a
 * glance instead of a wall of small numbers to squint at.
 *
 * Colour is banded (green / amber / red) rather than a continuous ramp, so 9.1
 * and 9.4 always look the same and you learn three states.
 *
 * `mine` inverts it: the viewer's own score is a SOLID disc in its band colour
 * with a dark arc, so your number and the crowd's can never be mistaken for
 * each other even at thumbnail size.
 */
export function ScoreChip({
  score,
  percent,
  mine = false,
  size = "md",
  className,
}: {
  /** The viewer's own 0–10 score. Wins over `percent` when both are given. */
  score?: number | null;
  /** AniList's 0–100 average. Converted here. */
  percent?: number | null;
  mine?: boolean;
  size?: Size;
  className?: string;
}) {
  const value = score ?? percentToTen(percent);
  if (value == null) return null;

  // A perfect score drops its decimal: "10.0" is four characters inside a 34px
  // disc, and the tenth on a 10 tells you nothing.
  const text =
    value >= 9.95
      ? "10"
      : score != null
        ? formatScore(score)
        : formatPercentAsTen(percent);

  const color = scoreColor(value);
  const { box, text: type, stroke } = SIZE[size];
  const arc = (Math.max(0, Math.min(10, value)) / 10) * C;

  return (
    <span
      role="img"
      aria-label={
        mine ? `Your score: ${text} out of 10` : `Community score: ${text} out of 10`
      }
      title={
        mine ? `Your score: ${text} out of 10` : `Community score: ${text} out of 10`
      }
      className={cn("relative grid shrink-0 place-items-center", box, className)}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: mine ? color : "oklch(0.14 0.02 265 / 0.78)",
          boxShadow: mine
            ? `0 2px 10px -2px color-mix(in oklch, ${color} 55%, transparent), inset 0 0 0 1px oklch(1 0 0 / 0.22)`
            : "0 2px 10px -2px oklch(0 0 0 / 0.6), inset 0 0 0 1px oklch(1 0 0 / 0.14)",
          backdropFilter: mine ? undefined : "blur(var(--blur-glass-1))",
        }}
        aria-hidden
      />

      <svg
        viewBox="0 0 36 36"
        className="absolute inset-0 size-full -rotate-90"
        aria-hidden
      >
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          strokeWidth={stroke}
          stroke={mine ? "oklch(0 0 0 / 0.22)" : "oklch(1 0 0 / 0.17)"}
        />
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={mine ? "oklch(0.17 0.02 265 / 0.9)" : color}
          strokeDasharray={`${arc} ${C}`}
        />
      </svg>

      <span
        className={cn("numeral relative leading-none", type)}
        style={{
          color: mine ? "oklch(0.16 0.02 265)" : "oklch(1 0 0 / 0.97)",
          textShadow: mine ? undefined : "0 1px 3px oklch(0 0 0 / 0.6)",
        }}
      >
        {text}
      </span>
    </span>
  );
}

/**
 * The same figure at display scale, for page headers. No disc — it sits on a
 * panel, not on artwork.
 */
export function ScoreDisplay({
  score,
  percent,
  label,
  className,
}: {
  score?: number | null;
  percent?: number | null;
  label: string;
  className?: string;
}) {
  const value = score ?? percentToTen(percent);
  const text =
    value == null ? "—" : score != null ? formatScore(score) : formatPercentAsTen(percent);

  return (
    <div className={cn("min-w-0", className)}>
      <p className="axis-caps text-fg-3 mb-1">{label}</p>
      <p
        className="numeral text-4xl leading-none sm:text-5xl"
        style={{ color: value == null ? "var(--text-tertiary)" : scoreColor(value) }}
      >
        {text}
      </p>
    </div>
  );
}
