"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tri-state filter chip — the signature Discover interaction.
 *
 *   neutral  →  include  →  exclude  →  neutral  →  …
 *
 * The three states are distinguished by THREE signals at once (fill, border,
 * and icon), not by colour alone, so the state is unambiguous at a glance and
 * still readable for colour-blind users.
 */
export type TriState = "neutral" | "include" | "exclude";

export const TRI_CYCLE: Record<TriState, TriState> = {
  neutral: "include",
  include: "exclude",
  exclude: "neutral",
};

export function nextTriState(current: TriState): TriState {
  return TRI_CYCLE[current];
}

const STATE_LABEL: Record<TriState, string> = {
  neutral: "not filtered",
  include: "included",
  exclude: "excluded",
};

export interface TriStateChipProps {
  label: string;
  state: TriState;
  onChange: (next: TriState) => void;
  count?: number;
  className?: string;
  /** Optional accent override, e.g. a media-type colour. */
  accent?: string;
}

export function TriStateChip({
  label,
  state,
  onChange,
  count,
  className,
  accent,
}: TriStateChipProps) {
  const accentColor = accent ?? "var(--accent)";

  return (
    <button
      type="button"
      onClick={() => onChange(nextTriState(state))}
      onContextMenu={(e) => {
        // Right-click clears — a shortcut out of the cycle.
        e.preventDefault();
        onChange("neutral");
      }}
      aria-pressed={state !== "neutral"}
      aria-label={`${label}, ${STATE_LABEL[state]}. Activate to cycle filter state.`}
      data-state={state}
      className={cn(
        "group relative inline-flex h-8 items-center gap-1.5 rounded-pill px-3",
        "text-xs font-medium select-none",
        "transition-[background,border-color,color,transform] duration-200",
        "[transition-timing-function:var(--ease-glass)] active:scale-[0.95]",
        // neutral: quiet frosted pill
        state === "neutral" &&
          "glass-subtle border border-hairline text-fg-2 hover:text-fg hover:bg-[var(--glass-hover)]",
        // include: solid accent fill
        state === "include" && "border text-white",
        // exclude: hollow, dashed, struck through
        state === "exclude" &&
          "border border-dashed text-[var(--danger)] line-through decoration-1",
        className,
      )}
      style={
        state === "include"
          ? {
              background: `color-mix(in oklch, ${accentColor} 82%, transparent)`,
              borderColor: accentColor,
              boxShadow: `0 4px 14px -6px ${accentColor}`,
            }
          : state === "exclude"
            ? {
                background:
                  "color-mix(in oklch, var(--danger) 12%, transparent)",
                borderColor:
                  "color-mix(in oklch, var(--danger) 55%, transparent)",
              }
            : undefined
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {state !== "neutral" && (
          <motion.span
            key={state}
            initial={{ width: 0, opacity: 0, scale: 0.5 }}
            animate={{ width: 12, opacity: 1, scale: 1 }}
            exit={{ width: 0, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="inline-flex shrink-0 items-center justify-center overflow-hidden"
          >
            {state === "include" ? (
              <Check className="size-3" strokeWidth={3} />
            ) : (
              <Minus className="size-3" strokeWidth={3} />
            )}
          </motion.span>
        )}
      </AnimatePresence>

      <span>{label}</span>

      {count != null && state === "neutral" && (
        <span className="text-fg-3 tabular-nums">{count}</span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* State container                                                            */
/* -------------------------------------------------------------------------- */

export interface TriStateSet {
  include: string[];
  exclude: string[];
}

export const EMPTY_TRI_SET: TriStateSet = { include: [], exclude: [] };

export function triStateOf(set: TriStateSet, value: string): TriState {
  if (set.include.includes(value)) return "include";
  if (set.exclude.includes(value)) return "exclude";
  return "neutral";
}

/** Immutably move `value` into its new bucket. */
export function applyTriState(
  set: TriStateSet,
  value: string,
  next: TriState,
): TriStateSet {
  const include = set.include.filter((v) => v !== value);
  const exclude = set.exclude.filter((v) => v !== value);
  if (next === "include") include.push(value);
  if (next === "exclude") exclude.push(value);
  return { include, exclude };
}

export function triSetSize(set: TriStateSet) {
  return set.include.length + set.exclude.length;
}

/** Serialize for the URL: "Action,Comedy!Ecchi" (! prefixes exclusions). */
export function serializeTriSet(set: TriStateSet): string | null {
  const parts = [
    ...set.include.map(encodeURIComponent),
    ...set.exclude.map((v) => `!${encodeURIComponent(v)}`),
  ];
  return parts.length ? parts.join(",") : null;
}

export function parseTriSet(raw: string | null | undefined): TriStateSet {
  if (!raw) return EMPTY_TRI_SET;
  const set: TriStateSet = { include: [], exclude: [] };
  for (const part of raw.split(",")) {
    if (!part) continue;
    if (part.startsWith("!")) set.exclude.push(decodeURIComponent(part.slice(1)));
    else set.include.push(decodeURIComponent(part));
  }
  return set;
}
