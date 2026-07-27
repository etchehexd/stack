"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { RatingDialog } from "./rating-dialog";
import { ScoreChip } from "./score-chip";
import { BUCKETS, bucketOf, scoreColor } from "@/lib/rating";
import { cn } from "@/lib/utils";

/**
 * The single entry point into rating. Shows the current score as the same dial
 * that appears on every poster, so "your rating" looks identical wherever it
 * turns up; otherwise it invites one.
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
          "group/rate inline-flex h-12 items-center gap-3 rounded-xl border pr-4 pl-2.5",
          "transition-[transform,border-color,background,box-shadow] duration-200",
          "hover:-translate-y-0.5 active:scale-[0.98]",
          className,
        )}
        style={
          score != null
            ? {
                borderColor: `color-mix(in oklch, ${color} 45%, transparent)`,
                background: `color-mix(in oklch, ${color} 13%, transparent)`,
                boxShadow: `0 8px 24px -14px ${color}`,
              }
            : {
                borderColor: "var(--glass-border-strong)",
                background: "var(--glass-1)",
              }
        }
      >
        {score != null ? (
          <>
            <ScoreChip score={score} mine size="md" />
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
            <span
              className="grid size-8 place-items-center rounded-full transition-transform duration-300 group-hover/rate:scale-110"
              style={{ background: "var(--glass-2)" }}
            >
              <Star className="text-fg-2 size-4" strokeWidth={2.4} />
            </span>
            <span className="text-sm font-bold tracking-tight">Rate it</span>
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
