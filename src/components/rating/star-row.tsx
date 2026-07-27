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
  /** Caller is already rendering the axis name and value above the stars. */
  hideHeader?: boolean;
  disabled?: boolean;
}

const SIZES = {
  sm: { star: 20, gap: 3 },
  md: { star: 30, gap: 5 },
  lg: { star: 38, gap: 6 },
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
  hideHeader = false,
  disabled = false,
}: StarRowProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const { star: starSize, gap } = SIZES[size];

  // What the stars should *look* like right now — hover wins while pointing.
  const shown = hover ?? value ?? 0;
  const previewing = hover != null && hover !== value;

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
    <div className="flex flex-col gap-2">
      {/* The axis name is set as a small-caps word rather than a coloured chip:
          the stars below already carry the colour, so repeating it in a label
          background just makes two competing blocks of hue. */}
      {!hideHeader && (
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <span className="axis-caps" style={{ color }}>
              {label}
            </span>
            {description && (
              <span className="text-fg-3 ml-2.5 hidden text-xs sm:inline">
                {description}
              </span>
            )}
          </div>

          <span
            className={cn(
              "numeral shrink-0 text-base transition-opacity",
              previewing && "opacity-55",
            )}
            aria-hidden
            style={{ color: shown === 0 ? "var(--text-tertiary)" : color }}
          >
            {shown === 0 ? "—" : (shown * 2).toFixed(1)}
          </span>
        </div>
      )}

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
                <StarGlyph
                  fill={fill}
                  color={color}
                  size={starSize}
                  muted={previewing}
                />

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
          <div className="glass-subtle rounded-pill flex items-center gap-0.5 p-0.5">
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

/**
 * A single star, filled 0…1 horizontally.
 *
 * The glyph is deliberately not the rounded lucide star: sharper points and a
 * smaller inner radius give it a printed, typographic weight and — the reason
 * that matters here — make a half-fill read as a clean vertical split instead
 * of an ambiguous smudge. Empty stars are drawn as a hairline outline so an
 * unrated row still has five legible marks rather than five grey blobs.
 */
const STAR_PATH =
  "M12 1.4 15.09 8.62 22.9 9.32 17 14.5 18.74 22.16 12 18.1 5.26 22.16 7 14.5 1.1 9.32 8.91 8.62Z";

function StarGlyph({
  fill,
  color,
  size,
  muted,
}: {
  fill: number;
  color: string;
  size: number;
  muted: boolean;
}) {
  const clipId = React.useId();

  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      animate={{ scale: fill > 0 ? 1 : 0.9, opacity: muted && fill > 0 ? 0.62 : 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 26 }}
      className="pointer-events-none block overflow-visible"
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * fill} height="24" />
        </clipPath>
      </defs>

      {/* Empty outline — a hairline, not a fill. */}
      <path
        d={STAR_PATH}
        fill="none"
        stroke="var(--glass-border-strong)"
        strokeWidth="1.25"
        strokeLinejoin="miter"
        strokeMiterlimit="8"
      />

      {fill > 0 && (
        <g clipPath={`url(#${clipId})`}>
          <path d={STAR_PATH} fill={color} />
          {/* Re-strike the outline over the fill so the point geometry stays
              crisp at small sizes instead of going soft. */}
          <path
            d={STAR_PATH}
            fill="none"
            stroke={color}
            strokeWidth="1.25"
            strokeLinejoin="miter"
            strokeMiterlimit="8"
          />
        </g>
      )}
    </motion.svg>
  );
}
