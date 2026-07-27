"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional accent for the active pill (e.g. media-type colour). */
  accent?: string;
  count?: number;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  /** Unique id so multiple segmented controls animate independently. */
  layoutId?: string;
}

/**
 * iOS-style segmented control: a frosted track with a sliding glass thumb.
 * The thumb is a shared layout animation, so it physically travels between
 * segments rather than cross-fading.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  layoutId,
}: SegmentedProps<T>) {
  const id = React.useId();
  const thumbId = layoutId ?? `segmented-thumb-${id}`;

  return (
    <div
      role="tablist"
      className={cn(
        "glass-subtle specular inline-flex items-center gap-1 rounded-pill p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-pill font-medium transition-colors duration-200",
              size === "sm" ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm",
              active ? "text-fg" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {active && (
              <motion.span
                layoutId={thumbId}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-pill border border-hairline-strong bg-[var(--glass-3)]"
                style={
                  option.accent
                    ? {
                        background: `color-mix(in oklch, ${option.accent} 22%, var(--glass-3))`,
                        borderColor: `color-mix(in oklch, ${option.accent} 45%, transparent)`,
                      }
                    : undefined
                }
              />
            )}
            <span className="relative z-1 inline-flex items-center gap-1.5">
              {option.label}
              {option.count != null && (
                <span
                  className={cn(
                    "tabular-nums",
                    active ? "text-fg-2" : "text-fg-3",
                    size === "sm" ? "text-[10px]" : "text-xs",
                  )}
                >
                  {option.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
