"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";

import {
  AXIS_META,
  QUADRANTS,
  QUADRANT_PIVOT,
  RATING_MAX,
  RATING_MIN,
  quadrantOf,
  toPlotPosition,
} from "@/lib/rating";
import { cn } from "@/lib/utils";

export interface ScatterPoint {
  id: string;
  enjoyment: number;
  craft: number;
  label?: string;
  cover?: string | null;
  href?: string;
  color?: string | null;
}

export interface RatingScatterProps {
  points: ScatterPoint[];
  /** The user's live/own rating, drawn larger and on top. */
  active?: { enjoyment: number | null; craft: number | null } | null;
  /**
   * "compact" is the small supporting visual inside the rating flow.
   * "full" is the profile-page chart: bigger, labelled, interactive.
   */
  variant?: "compact" | "full";
  className?: string;
  onPointClick?: (point: ScatterPoint) => void;
}

/**
 * Enjoyment (x) × Craft (y).
 *
 * This is a VISUALISATION of a rating, never the input for it — the star rows
 * are the input. In `compact` mode it exists purely so you can see where your
 * two star ratings land relative to each other.
 */
export function RatingScatter({
  points,
  active,
  variant = "compact",
  className,
  onPointClick,
}: RatingScatterProps) {
  const compact = variant === "compact";
  const [hovered, setHovered] = React.useState<ScatterPoint | null>(null);

  // Grid lines at every half star.
  const ticks = React.useMemo(() => {
    const out: number[] = [];
    for (let v = RATING_MIN; v <= RATING_MAX + 1e-9; v += 0.5) out.push(v);
    return out;
  }, []);

  const activePos =
    active?.enjoyment != null && active?.craft != null
      ? toPlotPosition(active.enjoyment, active.craft)
      : null;

  const activeQuadrant = quadrantOf(active?.enjoyment ?? null, active?.craft ?? null);

  return (
    <figure className={cn("flex flex-col", className)}>
      <div
        className={cn(
          "glass-subtle specular relative aspect-square w-full overflow-hidden",
          compact ? "rounded-md" : "rounded-lg",
        )}
      >
        {/* Quadrant tints — subtle, just enough to read the four zones. */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2" aria-hidden>
          <QuadrantCell meta={QUADRANTS.respected} compact={compact} />
          <QuadrantCell meta={QUADRANTS.favorites} compact={compact} />
          <QuadrantCell meta={QUADRANTS.notforyou} compact={compact} />
          <QuadrantCell meta={QUADRANTS.guilty} compact={compact} />
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          {ticks.map((t) => {
            const p = (t - RATING_MIN) / (RATING_MAX - RATING_MIN);
            const major = t % 1 === 0;
            return (
              <g key={t}>
                <line
                  x1={p * 100}
                  y1="0"
                  x2={p * 100}
                  y2="100"
                  stroke="var(--glass-border)"
                  strokeWidth={major ? 0.4 : 0.2}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1="0"
                  y1={(1 - p) * 100}
                  x2="100"
                  y2={(1 - p) * 100}
                  stroke="var(--glass-border)"
                  strokeWidth={major ? 0.4 : 0.2}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {/* The pivot cross that divides the quadrants */}
          <line
            x1={((QUADRANT_PIVOT - RATING_MIN) / 4.5) * 100}
            y1="0"
            x2={((QUADRANT_PIVOT - RATING_MIN) / 4.5) * 100}
            y2="100"
            stroke="var(--glass-border-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1={(1 - (QUADRANT_PIVOT - RATING_MIN) / 4.5) * 100}
            x2="100"
            y2={(1 - (QUADRANT_PIVOT - RATING_MIN) / 4.5) * 100}
            stroke="var(--glass-border-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Other people's / the user's existing points */}
        {points.map((point) => {
          const { x, y } = toPlotPosition(point.enjoyment, point.craft);
          const interactive = Boolean(onPointClick || point.href);
          return (
            <motion.button
              key={point.id}
              type="button"
              tabIndex={interactive ? 0 : -1}
              aria-label={
                point.label
                  ? `${point.label}: enjoyment ${point.enjoyment}, craft ${point.craft}`
                  : undefined
              }
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              whileHover={interactive ? { scale: 1.6 } : undefined}
              onHoverStart={() => setHovered(point)}
              onHoverEnd={() => setHovered(null)}
              onFocus={() => setHovered(point)}
              onBlur={() => setHovered(null)}
              onClick={() => onPointClick?.(point)}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
                compact ? "size-1.5" : "size-2.5",
                interactive ? "cursor-pointer" : "pointer-events-none",
              )}
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                background:
                  point.color ??
                  "color-mix(in oklch, var(--text-primary) 55%, transparent)",
                boxShadow: "0 0 0 1px oklch(0 0 0 / 0.35)",
              }}
            />
          );
        })}

        {/* The live/active dot */}
        <AnimatePresence>
          {activePos && (
            <motion.div
              key="active-dot"
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                left: `${activePos.x * 100}%`,
                top: `${activePos.y * 100}%`,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            >
              <span
                className={cn(
                  "block rounded-full",
                  compact ? "size-3.5" : "size-4",
                )}
                style={{
                  background: `linear-gradient(135deg, ${AXIS_META.enjoyment.color}, ${AXIS_META.craft.color})`,
                  boxShadow: `0 0 0 2px var(--bg-base), 0 0 18px ${activeQuadrant?.color ?? "var(--accent)"}`,
                }}
              />
              {/* soft halo pulse so the dot reads as "live" */}
              <motion.span
                className="absolute inset-0 rounded-full"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                style={{ background: activeQuadrant?.color ?? "var(--accent)" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Axis labels live inside the plot in compact mode to save height */}
        <span
          className="text-fg-3 pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-medium tracking-wide uppercase"
          style={{ color: AXIS_META.enjoyment.color, opacity: 0.85 }}
        >
          Enjoyment →
        </span>
        <span
          className="pointer-events-none absolute top-1/2 left-1.5 origin-left -translate-y-1/2 -rotate-90 text-[10px] font-medium tracking-wide uppercase"
          style={{
            color: AXIS_META.craft.color,
            opacity: 0.85,
            transform: "translateY(-50%) rotate(-90deg) translateX(-50%)",
          }}
        >
          Craft →
        </span>

        {/* Hover readout (full variant only) */}
        {!compact && hovered && (
          <div className="glass-heavy pointer-events-none absolute top-2 left-2 max-w-[70%] rounded-sm px-2.5 py-1.5">
            <p className="truncate text-xs font-medium">{hovered.label}</p>
            <p className="text-fg-3 text-[11px] tabular-nums">
              E {hovered.enjoyment.toFixed(1)} · C {hovered.craft.toFixed(1)}
            </p>
          </div>
        )}
      </div>

      {/* Caption: which quadrant the active rating landed in */}
      {activeQuadrant && (
        <AnimatePresence mode="wait">
          <motion.figcaption
            key={activeQuadrant.key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-2 text-center"
          >
            <span
              className="text-xs font-semibold"
              style={{ color: activeQuadrant.color }}
            >
              {activeQuadrant.label}
            </span>
            {!compact && (
              <span className="text-fg-3 ml-2 text-xs">
                {activeQuadrant.description}
              </span>
            )}
          </motion.figcaption>
        </AnimatePresence>
      )}
    </figure>
  );
}

function QuadrantCell({
  meta,
  compact,
}: {
  meta: (typeof QUADRANTS)[keyof typeof QUADRANTS];
  compact: boolean;
}) {
  return (
    <div
      className="relative"
      style={{
        background: `color-mix(in oklch, ${meta.color} ${compact ? 7 : 9}%, transparent)`,
      }}
    >
      {!compact && (
        <span
          className="absolute inset-x-2 top-2 text-[10px] font-semibold tracking-wide uppercase opacity-60"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
      )}
    </div>
  );
}
