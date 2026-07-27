import { AXIS_META, BAND_COLOR, formatTen, scoreBand } from "@/lib/rating";
import { cn } from "@/lib/utils";

/* ==========================================================================
   SCORE DISPLAY
   Two components, one scale. Everything the user reads as a score in this app
   is a 0–10 figure with one decimal — see lib/rating.ts for why.

   Score      the catalog's community average. One number.
   DualScore  the user's own rating. Two numbers, never averaged into one.
   ========================================================================== */

export interface ScoreProps {
  /** AniList percentage, 0–100. Converted here; don't pre-divide it. */
  percent: number | null;
  size?: "sm" | "md" | "lg";
  /** Show the "/10" denominator. Off in tight spots where it's understood. */
  showScale?: boolean;
  className?: string;
}

const SCORE_SIZE = {
  sm: { num: "text-[13px]", scale: "text-[9px]", pad: "px-1.5 py-0.5 gap-0.5" },
  md: { num: "text-lg", scale: "text-[10px]", pad: "px-2 py-1 gap-1" },
  lg: { num: "text-4xl sm:text-5xl", scale: "text-xs", pad: "gap-1.5" },
} as const;

/**
 * The community score.
 *
 * Coloured by band rather than by a continuous ramp, so a 9.1 and a 9.4 are the
 * same green and you learn the three tiers instead of squinting at hues.
 */
export function Score({
  percent,
  size = "md",
  showScale = true,
  className,
}: ScoreProps) {
  if (percent == null) return null;

  const ten = Math.round(percent) / 10;
  const band = scoreBand(ten)!;
  const s = SCORE_SIZE[size];

  return (
    <span
      className={cn("inline-flex items-baseline", s.pad, className)}
      style={{ color: BAND_COLOR[band] }}
      title={`Community score ${ten.toFixed(1)} out of 10`}
    >
      <span className={cn("numeral leading-none", s.num)}>{ten.toFixed(1)}</span>
      {showScale && (
        <span className={cn("font-medium opacity-55", s.scale)}>/10</span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

export interface DualScoreProps {
  /** Both on the stored 0.5–5 star scale. Converted for display. */
  enjoyment: number | null;
  craft: number | null;
  size?: "xs" | "sm" | "md" | "lg";
  /** Name the axes. Off where the amber/cyan pairing is already established. */
  labels?: boolean;
  className?: string;
}

const DUAL_SIZE = {
  xs: { num: "text-[11px]", label: "text-[8px]", bar: "h-[3px]", gap: "gap-1.5" },
  sm: { num: "text-[13px]", label: "text-[9px]", bar: "h-[3px]", gap: "gap-2" },
  md: { num: "text-xl", label: "text-[10px]", bar: "h-1", gap: "gap-3" },
  lg: { num: "text-4xl", label: "text-[11px]", bar: "h-1.5", gap: "gap-4" },
} as const;

/**
 * The user's own rating: enjoyment and craft, side by side, each with a bar
 * showing how full it is.
 *
 * The bar is the reason this reads at a glance. Two bare numbers make you
 * compare digits; two part-filled tracks make the difference between them a
 * shape, and a title where the amber runs long and the cyan runs short is
 * legible before you've read either figure.
 *
 * These are never averaged. If you want one number, you want the wrong thing —
 * see the note at the top of lib/rating.ts.
 */
export function DualScore({
  enjoyment,
  craft,
  size = "md",
  labels = false,
  className,
}: DualScoreProps) {
  if (enjoyment == null && craft == null) return null;
  const s = DUAL_SIZE[size];

  return (
    <div
      className={cn("flex min-w-0", s.gap, className)}
      title={`Enjoyment ${formatTen(enjoyment)} · Craft ${formatTen(craft)}`}
    >
      <Axis
        value={enjoyment}
        color={AXIS_META.enjoyment.color}
        label={labels ? "Enjoyment" : null}
        s={s}
      />
      <Axis
        value={craft}
        color={AXIS_META.craft.color}
        label={labels ? "Craft" : null}
        s={s}
      />
    </div>
  );
}

function Axis({
  value,
  color,
  label,
  s,
}: {
  value: number | null;
  color: string;
  label: string | null;
  s: (typeof DUAL_SIZE)[keyof typeof DUAL_SIZE];
}) {
  const pct = value == null ? 0 : (value / 5) * 100;

  return (
    <div className="min-w-0 flex-1">
      {label && (
        <span
          className={cn("axis-caps block truncate", s.label)}
          style={{ color, letterSpacing: "0.1em" }}
        >
          {label}
        </span>
      )}
      <span
        className={cn("numeral block leading-none", s.num, label && "mt-1")}
        style={{ color: value == null ? "var(--text-tertiary)" : color }}
      >
        {formatTen(value)}
      </span>
      <span
        className={cn(
          "mt-1.5 block w-full overflow-hidden rounded-full bg-[var(--glass-1)]",
          s.bar,
        )}
      >
        <span
          className="block h-full rounded-full transition-[width] duration-500 ease-[var(--ease-spring-out)]"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
    </div>
  );
}
