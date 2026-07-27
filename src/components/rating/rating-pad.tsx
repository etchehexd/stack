"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { saveRating } from "@/app/actions/rating";
import { AXIS_META } from "@/lib/rating";
import { cn } from "@/lib/utils";
import { RatingScatter, type ScatterPoint } from "./rating-scatter";
import { StarRow } from "./star-row";

export interface RatingPadProps {
  titleId: string;
  initialEnjoyment: number | null;
  initialCraft: number | null;
  /** Faint context dots: this user's other ratings. Optional. */
  contextPoints?: ScatterPoint[];
  onSaved?: (enjoyment: number | null, craft: number | null) => void;
  className?: string;
}

/**
 * The rating flow. Two star rows are the PRIMARY interaction; the little
 * scatter to the side is a live readout of where they land — deliberately
 * compact so this stays a five-second task.
 *
 * Saving is debounced and automatic: no submit button to hunt for.
 */
export function RatingPad({
  titleId,
  initialEnjoyment,
  initialCraft,
  contextPoints = [],
  onSaved,
  className,
}: RatingPadProps) {
  const [enjoyment, setEnjoyment] = React.useState(initialEnjoyment);
  const [craft, setCraft] = React.useState(initialCraft);
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = React.useState<string | null>(null);

  // Skip the save that would otherwise fire on first render.
  const dirty = React.useRef(false);

  React.useEffect(() => {
    if (!dirty.current) return;

    setState("saving");
    const timer = setTimeout(async () => {
      const result = await saveRating({ titleId, enjoyment, craft });
      if (result.ok) {
        setState("saved");
        setError(null);
        onSaved?.(enjoyment, craft);
        setTimeout(() => setState("idle"), 1600);
      } else {
        setState("error");
        setError(result.error ?? "Could not save.");
      }
    }, 600);

    return () => clearTimeout(timer);
    // onSaved is intentionally excluded — callers often pass an inline fn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enjoyment, craft, titleId]);

  function update(next: { enjoyment?: number | null; craft?: number | null }) {
    dirty.current = true;
    if (next.enjoyment !== undefined) setEnjoyment(next.enjoyment);
    if (next.craft !== undefined) setCraft(next.craft);
  }

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <StarRow
          label={AXIS_META.enjoyment.label}
          description={AXIS_META.enjoyment.blurb}
          color={AXIS_META.enjoyment.color}
          value={enjoyment}
          onChange={(v) => update({ enjoyment: v })}
        />

        <StarRow
          label={AXIS_META.craft.label}
          description={AXIS_META.craft.blurb}
          color={AXIS_META.craft.color}
          value={craft}
          onChange={(v) => update({ craft: v })}
        />

        <div className="flex h-5 items-center gap-1.5 text-xs" aria-live="polite">
          {state === "saving" && (
            <>
              <Loader2 className="text-fg-3 size-3.5 animate-spin" />
              <span className="text-fg-3">Saving…</span>
            </>
          )}
          {state === "saved" && (
            <>
              <Check className="size-3.5 text-[var(--success)]" />
              <span className="text-[var(--success)]">Saved</span>
            </>
          )}
          {state === "error" && (
            <span className="text-[var(--danger)]">{error}</span>
          )}
          {state === "idle" && enjoyment == null && craft == null && (
            <span className="text-fg-3">
              Rate either axis — they&rsquo;re independent.
            </span>
          )}
        </div>
      </div>

      {/* Compact by design: a supporting visual, not the input. */}
      <RatingScatter
        variant="compact"
        points={contextPoints}
        active={{ enjoyment, craft }}
        className="w-full shrink-0 sm:w-44"
      />
    </div>
  );
}
