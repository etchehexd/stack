"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { RatingDialog } from "./rating-dialog";
import { BUCKETS, bucketOf, formatScore, scoreColor } from "@/lib/rating";
import { cn } from "@/lib/utils";

/**
 * The single entry point into rating. Shows the current score if there is one,
 * otherwise invites a rating; either way it opens the dialog.
 */
export function RateButton({
  titleId,
  titleName,
  cover,
  coverColor,
  score,
  ratedCount,
  className,
}: {
  titleId: string;
  titleName: string;
  cover: string | null;
  coverColor: string | null;
  score: number | null;
  ratedCount: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const bucket = bucketOf(score);
  const color = scoreColor(score);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group/rate inline-flex h-11 items-center gap-3 rounded-xl border pr-4 pl-3",
          "transition-[transform,border-color,background] duration-200",
          "hover:-translate-y-0.5 active:scale-[0.98]",
          className,
        )}
        style={
          score != null
            ? {
                borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
                background: `color-mix(in oklch, ${color} 12%, transparent)`,
              }
            : {
                borderColor: "var(--glass-border-strong)",
                background: "var(--glass-1)",
              }
        }
      >
        {score != null ? (
          <>
            <span
              className="numeral text-2xl leading-none"
              style={{ color }}
            >
              {formatScore(score)}
            </span>
            <span className="text-left">
              <span className="axis-caps block" style={{ color }}>
                {BUCKETS[bucket!].label}
              </span>
              <span className="text-fg-3 mt-0.5 block text-[11px]">
                Tap to re-rate
              </span>
            </span>
          </>
        ) : (
          <>
            <Star className="text-fg-2 size-4" strokeWidth={2.4} />
            <span className="text-sm font-semibold tracking-tight">Rate it</span>
          </>
        )}
      </button>

      <RatingDialog
        open={open}
        onClose={() => setOpen(false)}
        titleId={titleId}
        titleName={titleName}
        cover={cover}
        coverColor={coverColor}
        currentScore={score}
        ratedCount={ratedCount}
      />
    </>
  );
}
