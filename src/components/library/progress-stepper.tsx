"use client";

import * as React from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";

import { incrementProgress, upsertLibraryEntry } from "@/app/actions/library";
import type { LibraryStatus, MediaType } from "@/lib/types/database";
import { cn, unitNoun } from "@/lib/utils";

export interface ProgressStepperProps {
  titleId: string;
  mediaType: MediaType;
  total: number | null;
  progress: number;
  onChange?: (progress: number, status: LibraryStatus) => void;
  size?: "sm" | "md";
  className?: string;
}

/**
 * "Tap +1", not "open a form".
 *
 * Optimistic: the number moves the instant you tap, then reconciles with the
 * server. Rapid taps are coalesced so holding +1 through a binge doesn't fire
 * twenty round-trips.
 */
export function ProgressStepper({
  titleId,
  mediaType,
  total,
  progress,
  onChange,
  size = "md",
  className,
}: ProgressStepperProps) {
  const [optimistic, setOptimistic] = React.useState(progress);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  // Pending delta waiting to be flushed to the server.
  const pendingDelta = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync when the server sends down a new value (e.g. after router.refresh).
  // Adjusting during render rather than in an effect avoids a wasted pass.
  const [lastProgress, setLastProgress] = React.useState(progress);
  if (lastProgress !== progress) {
    setLastProgress(progress);
    setOptimistic(progress);
  }

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function bump(delta: number) {
    const next = Math.max(0, total ? Math.min(optimistic + delta, total) : optimistic + delta);
    if (next === optimistic) return;

    setOptimistic(next);
    pendingDelta.current += next - optimistic;
    setSaving(true);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const delta = pendingDelta.current;
      pendingDelta.current = 0;
      const result = await incrementProgress(titleId, delta);
      setSaving(false);
      if (result.ok && result.progress != null) {
        setOptimistic(result.progress);
        onChange?.(result.progress, result.status ?? "watching");
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1200);
      } else {
        setOptimistic(progress); // roll back
      }
    }, 700);
  }

  const complete = total != null && optimistic >= total;
  const dims = size === "sm" ? "size-7" : "size-8";

  return (
    <div
      className={cn(
        "glass-subtle specular inline-flex items-center gap-1 rounded-pill p-1",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={optimistic === 0}
        aria-label={`One fewer ${unitNoun(mediaType)}`}
        className={cn(
          dims,
          "text-fg-2 hover:text-fg grid place-items-center rounded-full transition-[background,transform] duration-150 hover:bg-[var(--glass-hover)] active:scale-90 disabled:pointer-events-none disabled:opacity-30",
        )}
      >
        <Minus className="size-3.5" strokeWidth={2.5} />
      </button>

      <span
        className={cn(
          "min-w-14 text-center font-medium tabular-nums",
          size === "sm" ? "text-xs" : "text-sm",
          complete && "text-[var(--success)]",
        )}
        aria-live="polite"
      >
        {optimistic}
        <span className="text-fg-3">/{total ?? "?"}</span>
      </span>

      <button
        type="button"
        onClick={() => bump(1)}
        disabled={complete}
        aria-label={`One more ${unitNoun(mediaType)}`}
        className={cn(
          dims,
          "text-fg-2 hover:text-fg grid place-items-center rounded-full transition-[background,transform] duration-150 hover:bg-[var(--glass-hover)] active:scale-90 disabled:pointer-events-none disabled:opacity-30",
        )}
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
      </button>

      <span className="grid w-4 place-items-center">
        {saving && <Loader2 className="text-fg-3 size-3 animate-spin" />}
        {justSaved && !saving && <Check className="size-3 text-[var(--success)]" />}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Volume progress — manga / light novels only, always manual                 */
/* -------------------------------------------------------------------------- */

/**
 * AniList's volume counts are patchy and often stale, so volume tracking is
 * purely a user-owned field: we never prefill it, never require it, and hide
 * it entirely for anime. `knownTotal` is shown only as a hint when AniList
 * happens to have a number.
 */
export function VolumeField({
  titleId,
  value,
  knownTotal,
  className,
}: {
  titleId: string;
  value: number | null;
  knownTotal: number | null;
  className?: string;
}) {
  const [draft, setDraft] = React.useState(value?.toString() ?? "");
  const [saving, setSaving] = React.useState(false);

  const [lastValue, setLastValue] = React.useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value?.toString() ?? "");
  }

  async function commit() {
    const trimmed = draft.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
      setDraft(value?.toString() ?? "");
      return;
    }
    if (parsed === value) return;

    setSaving(true);
    await upsertLibraryEntry({ titleId, progressVolumes: parsed });
    setSaving(false);
  }

  return (
    <label className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span className="text-fg-3">Vol.</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="—"
        aria-label="Volume progress (optional, tracked manually)"
        className="glass-subtle placeholder:text-fg-3 h-7 w-14 rounded-pill px-2 text-center tabular-nums outline-none"
      />
      {knownTotal != null && <span className="text-fg-3">of {knownTotal}</span>}
      {saving && <Loader2 className="text-fg-3 size-3 animate-spin" />}
    </label>
  );
}
