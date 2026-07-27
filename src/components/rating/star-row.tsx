"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";

import {
  RATING_MAX,
  RATING_MIN,
  RATING_STEP,
  STAR_COUNT,
  snapToStep,
} from "@/lib/rating";
import { cn } from "@/lib/utils";

export interface StarRowProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Colour of filled stars — the axis accent. */
  color: string;
  label: string;
  /** Screen-reader description of what this axis means. */
  description?: string;
  size?: "sm" | "md" | "lg";
  /** Show the −/+ half-step buttons. On by default in the rating flow. */
  showStepper?: boolean;
  disabled?: boolean;
}

const SIZES = {
  sm: { star: 18, gap: 2 },
  md: { star: 26, gap: 3 },
  lg: { star: 34, gap: 4 },
} as const;

/**
 * A row of 5 half-fillable stars.
 *
 * Input methods, all equivalent:
 *   • tap/click the LEFT half of a star  → x.5
 *   • tap/click the RIGHT half of a star → x.0
 *   • −/+ stepper buttons                → ±0.5
 *   • keyboard arrows when focused       → ±0.5 (Home/End jump to min/max)
 *
 * Tapping the exact value that's already set clears the rating, matching the
 * behaviour people expect from Letterboxd.
 */
export function StarRow({
  value,
  onChange,
  color,
  label,
  description,
  size = "md",
  showStepper = true,
  disabled = false,
}: StarRowProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const { star: starSize, gap } = SIZES[size];

  // What the stars should *look* like right now — hover wins while pointing.
  const shown = hover ?? value ?? 0;

  function set(next: number | null) {
    if (disabled) return;
    onChange(next === null ? null : snapToStep(next));
  }

  function pick(next: number) {
    // Re-tapping the current value clears it.
    set(value === next ? null : next);
  }

  function step(delta: number) {
    const base = value ?? RATING_MIN - RATING_STEP;
    const next = base + delta;
    if (next < RATING_MIN) return set(null);
    set(Math.min(RATING_MAX, next));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        step(RATING_STEP);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        step(-RATING_STEP);
        break;
      case "Home":
        e.preventDefault();
        set(RATING_MIN);
        break;
      case "End":
        e.preventDefault();
        set(RATING_MAX);
        break;
      case "Backspace":
      case "Delete":
        e.preventDefault();
        set(null);
        break;
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-semibold" style={{ color }}>
            {label}
          </span>
          {description && (
            <span className="text-fg-3 ml-2 hidden text-xs sm:inline">
              {description}
            </span>
          )}
        </div>

        <span
          className="shrink-0 text-sm font-semibold tabular-nums"
          aria-hidden
          style={{ color: value == null ? "var(--text-tertiary)" : color }}
        >
          {value == null ? "—" : value.toFixed(1)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${label}${description ? `: ${description}` : ""}`}
          aria-valuemin={RATING_MIN}
          aria-valuemax={RATING_MAX}
          aria-valuenow={value ?? undefined}
          aria-valuetext={value == null ? "Not rated" : `${value} out of 5 stars`}
          aria-disabled={disabled || undefined}
          onKeyDown={onKeyDown}
          onPointerLeave={() => setHover(null)}
          className={cn(
            "flex rounded-sm outline-offset-4",
            disabled && "pointer-events-none opacity-50",
          )}
          style={{ gap }}
        >
          {Array.from({ length: STAR_COUNT }, (_, i) => {
            const starIndex = i + 1;
            const fill = Math.min(1, Math.max(0, shown - i));

            return (
              <div
                key={starIndex}
                className="relative"
                style={{ width: starSize, height: starSize }}
              >
                <StarGlyph fill={fill} color={color} size={starSize} />

                {/* Two invisible hit targets per star: left half and right half. */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onPointerEnter={() => setHover(starIndex - 0.5)}
                  onClick={() => pick(starIndex - 0.5)}
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onPointerEnter={() => setHover(starIndex)}
                  onClick={() => pick(starIndex)}
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                />
              </div>
            );
          })}
        </div>

        {showStepper && (
          <div className="glass-subtle flex items-center gap-0.5 rounded-pill p-0.5">
            <StepButton
              onClick={() => step(-RATING_STEP)}
              disabled={disabled || value == null}
              label={`Decrease ${label} by half a star`}
            >
              <Minus className="size-3.5" strokeWidth={2.5} />
            </StepButton>
            <StepButton
              onClick={() => step(RATING_STEP)}
              disabled={disabled || value === RATING_MAX}
              label={`Increase ${label} by half a star`}
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
            </StepButton>
          </div>
        )}

        {value != null && !disabled && (
          <button
            type="button"
            onClick={() => set(null)}
            aria-label={`Clear ${label} rating`}
            className="text-fg-3 hover:text-fg glass-press grid size-6 shrink-0 place-items-center rounded-full transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="text-fg-2 hover:text-fg grid size-6 place-items-center rounded-full transition-[background,color,transform] duration-150 hover:bg-[var(--glass-hover)] active:scale-90 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** A single star, filled 0…1 horizontally via a clip. */
function StarGlyph({
  fill,
  color,
  size,
}: {
  fill: number;
  color: string;
  size: number;
}) {
  const clipId = React.useId();
  const path =
    "M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.4l-5.8 3-1.1-6.47L.4 9.35l6.5-.95L12 2.5z";

  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      animate={{ scale: fill > 0 ? 1 : 0.94 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      className="pointer-events-none block"
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * fill} height="24" />
        </clipPath>
      </defs>

      {/* empty outline */}
      <path
        d={path}
        fill="none"
        stroke="var(--glass-border-strong)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* filled portion */}
      {fill > 0 && (
        <g clipPath={`url(#${clipId})`}>
          <path d={path} fill={color} />
        </g>
      )}
    </motion.svg>
  );
}
