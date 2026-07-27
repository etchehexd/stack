import { formatScore, scoreColor } from "@/lib/rating";
import { cn } from "@/lib/utils";

export interface DistributionProps {
  /** Ten buckets, low to high: 0–1, 1–2 … 9–10. */
  bins: number[];
  count: number;
  average: number | null;
  /** The viewer's own score, marked on the axis. */
  mine?: number | null;
  className?: string;
}

/**
 * How everyone rated this, as a histogram.
 *
 * Letterboxd's insight is that the shape of the distribution says more than the
 * mean: a flat 6.5 average made of tens and threes is a divisive film, and no
 * single number can tell you that. Ten columns, one per point of the scale,
 * each coloured by the band it falls in — so the picture is the same green /
 * amber / red vocabulary used everywhere else in the app.
 *
 * Deliberately not a smooth curve: with a handful of ratings a curve implies
 * precision that isn't there, while bars are honestly chunky.
 */
export function RatingDistribution({
  bins,
  count,
  average,
  mine,
  className,
}: DistributionProps) {
  const peak = Math.max(1, ...bins);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="axis-caps text-fg-3">Ratings</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className="numeral text-3xl leading-none"
              style={{
                color: average != null ? scoreColor(average) : "var(--text-tertiary)",
              }}
            >
              {average != null ? formatScore(average) : "—"}
            </span>
            <span className="text-fg-3 text-xs tabular-nums">
              {count === 0
                ? "no ratings yet"
                : `from ${count.toLocaleString()} ${count === 1 ? "rating" : "ratings"}`}
            </span>
          </p>
        </div>

        {mine != null && (
          <p className="shrink-0 text-right">
            <span className="axis-caps text-fg-3">Yours</span>
            <span
              className="numeral mt-1 block text-xl leading-none"
              style={{ color: scoreColor(mine) }}
            >
              {formatScore(mine)}
            </span>
          </p>
        )}
      </div>

      <div className="mt-4 flex h-24 items-end gap-[3px]">
        {bins.map((n, i) => {
          const low = i;
          const high = i + 1;
          const mid = i + 0.5;
          const isMine = mine != null && Math.ceil(mine) - 1 === i;
          const height = count === 0 ? 0 : (n / peak) * 100;

          return (
            <div
              key={i}
              className="group/bar relative flex h-full flex-1 items-end"
              title={`${n} ${n === 1 ? "rating" : "ratings"} between ${low} and ${high}`}
            >
              {/* The track, so empty columns still read as part of a scale. */}
              <span
                className="absolute inset-x-0 bottom-0 h-full rounded-t-sm"
                style={{ background: "var(--glass-1)" }}
                aria-hidden
              />
              <span
                className="relative w-full rounded-t-sm transition-[height,filter] duration-500 group-hover/bar:brightness-125"
                style={{
                  height: `${Math.max(n > 0 ? 6 : 0, height)}%`,
                  background: scoreColor(mid),
                  opacity: n === 0 ? 0 : 1,
                  boxShadow: isMine
                    ? `0 0 0 1.5px color-mix(in oklch, ${scoreColor(mid)} 70%, var(--text-primary))`
                    : undefined,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="text-fg-3 mt-2 flex justify-between text-[10px] tabular-nums">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}
