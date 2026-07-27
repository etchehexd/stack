import { formatPercentAsTen, formatScore, percentToTen, scoreColor } from "@/lib/rating";
import { cn } from "@/lib/utils";

/**
 * A score, drawn small.
 *
 * Sits on top of cover art, so it has to be legible over anything and take as
 * little of the poster as possible: no pill, no chip, no background plate —
 * just the figure, with a hard shadow to lift it off busy artwork and a short
 * colour rule underneath. The colour is banded (green / amber / red) rather
 * than a continuous ramp, so you learn three states instead of squinting at a
 * gradient.
 *
 * `mine` switches it from the catalog average to the viewer's own score, which
 * gets a filled bar instead of a rule so the two can never be confused.
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
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const value = score ?? percentToTen(percent);
  if (value == null) return null;

  const text = score != null ? formatScore(score) : formatPercentAsTen(percent);
  const color = scoreColor(value);

  const type = {
    sm: "text-[15px]",
    md: "text-[19px]",
    lg: "text-3xl",
  }[size];
  const rule = { sm: "w-5 h-[2px]", md: "w-6 h-[2px]", lg: "w-9 h-[3px]" }[size];

  return (
    <span
      className={cn("inline-flex flex-col items-start gap-[3px]", className)}
      title={
        mine ? `Your score: ${text} out of 10` : `Community score: ${text} out of 10`
      }
    >
      <span
        className={cn("numeral leading-none", type)}
        style={{
          color: mine ? color : "oklch(1 0 0 / 0.96)",
          textShadow: "0 1px 6px oklch(0 0 0 / 0.75)",
        }}
      >
        {text}
      </span>
      <span
        className={cn("block rounded-full", rule)}
        style={{
          background: color,
          opacity: mine ? 1 : 0.75,
        }}
      />
    </span>
  );
}

/**
 * The same figure at display scale, for page headers. No shadow — it sits on a
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
