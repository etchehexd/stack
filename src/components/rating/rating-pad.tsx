"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { saveRating } from "@/app/actions/rating";
import { AXIS_META, formatTen } from "@/lib/rating";
import { cn } from "@/lib/utils";
import { StarRow } from "./star-row";

export interface RatingPadProps {
  titleId: string;
  initialEnjoyment: number | null;
  initialCraft: number | null;
  onSaved?: (enjoyment: number | null, craft: number | null) => void;
  className?: string;
}

/**
 * The rating flow: two star rows, a live 0–10 readout, no submit button.
 *
 * Stars are the input because clicking a glyph is faster and more forgiving
 * than typing a decimal; the readout is on the 0–10 scale because that's the
 * scale every score in the app is shown on.
 */
export function RatingPad({
  titleId,
  initialEnjoyment,
  initialCraft,
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
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
        <AxisBlock
          axis="enjoyment"
          value={enjoyment}
          onChange={(v) => update({ enjoyment: v })}
        />
        <AxisBlock
          axis="craft"
          value={craft}
          onChange={(v) => update({ craft: v })}
        />
      </div>

      <div className="flex h-5 items-center gap-1.5 text-xs" aria-live="polite">
        {state === "saving" && (
          <>
            <Loader2 className="text-fg-3 size-3.5 animate-spin" />
            <span className="text-fg-3">Saving</span>
          </>
        )}
        {state === "saved" && (
          <>
            <Check className="size-3.5 text-[var(--success)]" />
            <span className="text-[var(--success)]">Saved</span>
          </>
        )}
        {state === "error" && <span className="text-[var(--danger)]">{error}</span>}
        {state === "idle" && (enjoyment == null || craft == null) && (
          <span className="text-fg-3">Either axis can stand on its own.</span>
        )}
      </div>
    </div>
  );
}

function AxisBlock({
  axis,
  value,
  onChange,
}: {
  axis: "enjoyment" | "craft";
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const meta = AXIS_META[axis];

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="axis-caps block" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-fg-3 mt-1 block text-[11px] leading-tight">
            {meta.blurb}
          </span>
        </div>
        <span
          className="numeral shrink-0 text-3xl leading-none"
          style={{ color: value == null ? "var(--text-tertiary)" : meta.color }}
        >
          {formatTen(value)}
        </span>
      </div>

      <StarRow
        label={meta.label}
        description={meta.blurb}
        color={meta.color}
        value={value}
        onChange={onChange}
        hideHeader
      />
    </div>
  );
}
