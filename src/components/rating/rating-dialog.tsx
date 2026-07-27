"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Trash2, X } from "lucide-react";

import {
  clearRating,
  getBucketList,
  placeRating,
  seedRating,
  type BucketItem,
} from "@/app/actions/rating";
import {
  BUCKETS,
  BUCKET_ORDER,
  SEED_TARGET,
  advance,
  bucketOf,
  formatScore,
  pivotIndex,
  placementDone,
  placementResult,
  scoreColor,
  startPlacement,
  type Bucket,
  type Placement,
} from "@/lib/rating";
import { cn } from "@/lib/utils";

export interface RatingDialogProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  titleName: string;
  cover: string | null;
  coverColor: string | null;
  currentScore: number | null;
  /** How many titles the viewer has rated. Decides seed vs. compare mode. */
  ratedCount: number;
}

type Stage = "bucket" | "seed" | "compare" | "done";

/**
 * The rating flow.
 *
 * Three screens at most, and only one question on screen at a time. The whole
 * point of a comparative system is that each individual decision is trivial —
 * putting two of them side by side would undo that.
 */
export function RatingDialog({
  open,
  onClose,
  titleId,
  titleName,
  cover,
  coverColor,
  currentScore,
  ratedCount,
}: RatingDialogProps) {
  const router = useRouter();
  const seeding = ratedCount < SEED_TARGET;

  const [stage, setStage] = React.useState<Stage>(seeding ? "seed" : "bucket");
  const [bucket, setBucket] = React.useState<Bucket | null>(null);
  const [items, setItems] = React.useState<BucketItem[]>([]);
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  const [seedValue, setSeedValue] = React.useState(currentScore ?? 7.0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [finalScore, setFinalScore] = React.useState<number | null>(null);

  // Reset every time the dialog is opened, so a second rating doesn't inherit
  // the first one's half-finished state. Done during render off a changed
  // prop rather than in an effect — an effect would paint the stale flow for
  // one frame before clearing it.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStage(seeding ? "seed" : "bucket");
      setBucket(null);
      setItems([]);
      setPlacement(null);
      setSeedValue(currentScore ?? 7.0);
      setError(null);
      setFinalScore(null);
      setBusy(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function finish(score: number) {
    setFinalScore(score);
    setStage("done");
    router.refresh();
    // Long enough to read the number, short enough not to be a wait.
    setTimeout(onClose, 1100);
  }

  async function chooseBucket(next: Bucket) {
    setBucket(next);
    setBusy(true);
    setError(null);

    const result = await getBucketList(next);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // An empty bucket has nothing to compare against — it goes straight in.
    if (result.data.items.length === 0) {
      await commit(next, 0);
      return;
    }

    setItems(result.data.items);
    setPlacement(startPlacement(result.data.items.length));
    setStage("compare");
  }

  async function commit(target: Bucket, position: number) {
    setBusy(true);
    const result = await placeRating({ titleId, bucket: target, position });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save that.");
      return;
    }
    finish(result.score ?? 0);
  }

  async function answer(preferredNew: boolean) {
    if (!placement || !bucket) return;
    const next = advance(placement, preferredNew);
    setPlacement(next);
    if (placementDone(next)) await commit(bucket, placementResult(next));
  }

  async function submitSeed() {
    setBusy(true);
    setError(null);
    const result = await seedRating({ titleId, score: seedValue });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save that.");
      return;
    }
    finish(result.score ?? seedValue);
  }

  async function remove() {
    setBusy(true);
    await clearRating(titleId);
    setBusy(false);
    router.refresh();
    onClose();
  }

  if (!open) return null;

  const opponent =
    placement && !placementDone(placement) ? items[pivotIndex(placement)] : null;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center"
      style={{ zIndex: "var(--z-sheet)" as unknown as number }}
      role="dialog"
      aria-modal="true"
      aria-label={`Rate ${titleName}`}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-scrim absolute inset-0"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className={cn(
          "glass-heavy relative w-full max-w-lg overflow-hidden",
          "rounded-t-2xl sm:rounded-2xl",
          "max-h-[92dvh] overflow-y-auto",
        )}
      >
        <header className="border-hairline flex items-start gap-3 border-b p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="axis-caps text-fg-3">
              {stage === "done"
                ? "Rated"
                : stage === "seed"
                  ? `Rating ${ratedCount + 1} of ${SEED_TARGET}`
                  : stage === "compare"
                    ? "Which did you prefer?"
                    : "How was it?"}
            </p>
            <h2 className="mt-1 truncate text-base font-bold tracking-tight">
              {titleName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-fg-3 hover:text-fg glass-subtle grid size-8 shrink-0 place-items-center rounded-full transition-colors"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="p-4 sm:p-5">
          <AnimatePresence mode="wait">
            {stage === "seed" && (
              <Fade key="seed">
                <SeedStep
                  value={seedValue}
                  onChange={setSeedValue}
                  cover={cover}
                  coverColor={coverColor}
                />
                <p className="text-fg-3 mt-5 text-xs leading-relaxed">
                  Type a score for your first {SEED_TARGET}. After that you
                  won&rsquo;t pick numbers again — you&rsquo;ll just say which of
                  two shows you liked more, and the number works itself out.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={submitSeed}
                    disabled={busy}
                    className="bg-accent flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
                    style={{ background: scoreColor(seedValue) }}
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Save {formatScore(seedValue)}
                  </button>
                  {currentScore != null && <RemoveButton onClick={remove} busy={busy} />}
                </div>
              </Fade>
            )}

            {stage === "bucket" && (
              <Fade key="bucket">
                <div className="flex flex-col gap-2">
                  {BUCKET_ORDER.map((key) => {
                    const meta = BUCKETS[key];
                    const isCurrent = bucketOf(currentScore) === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={busy}
                        onClick={() => chooseBucket(key)}
                        className={cn(
                          "group/b flex items-center gap-3.5 rounded-xl border p-3.5 text-left",
                          "transition-[transform,border-color,background] duration-200",
                          "hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-50",
                        )}
                        style={{
                          borderColor: `color-mix(in oklch, ${meta.color} ${isCurrent ? 55 : 22}%, transparent)`,
                          background: `color-mix(in oklch, ${meta.color} ${isCurrent ? 14 : 7}%, transparent)`,
                        }}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            background: meta.color,
                            boxShadow: `0 0 12px ${meta.color}`,
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className="block text-sm font-bold tracking-tight"
                            style={{ color: meta.color }}
                          >
                            {meta.label}
                          </span>
                          <span className="text-fg-3 mt-0.5 block text-xs">
                            {meta.blurb}
                          </span>
                        </span>
                        {busy && bucket === key && (
                          <Loader2 className="text-fg-3 size-4 shrink-0 animate-spin" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {currentScore != null && (
                  <div className="mt-4 flex justify-center">
                    <RemoveButton onClick={remove} busy={busy} wide />
                  </div>
                )}
              </Fade>
            )}

            {stage === "compare" && opponent && placement && (
              <Fade key={`compare-${placement.asked}`}>
                <div className="grid grid-cols-2 gap-3">
                  <Contender
                    name={titleName}
                    cover={cover}
                    color={coverColor}
                    caption="This one"
                    onClick={() => answer(true)}
                    disabled={busy}
                    highlight
                  />
                  <Contender
                    name={opponent.name}
                    cover={opponent.cover}
                    color={opponent.color}
                    caption={formatScore(opponent.score)}
                    onClick={() => answer(false)}
                    disabled={busy}
                  />
                </div>

                <Progress placement={placement} />
              </Fade>
            )}

            {stage === "done" && finalScore != null && (
              <Fade key="done">
                <div className="flex flex-col items-center py-6">
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 340, damping: 18 }}
                    className="numeral text-7xl leading-none"
                    style={{ color: scoreColor(finalScore) }}
                  >
                    {formatScore(finalScore)}
                  </motion.span>
                  <span
                    className="axis-caps mt-3"
                    style={{ color: scoreColor(finalScore) }}
                  >
                    {BUCKETS[bucketOf(finalScore)!].label}
                  </span>
                </div>
              </Fade>
            )}
          </AnimatePresence>

          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Fade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Contender({
  name,
  cover,
  color,
  caption,
  onClick,
  disabled,
  highlight,
}: {
  name: string;
  cover: string | null;
  color: string | null;
  caption: string;
  onClick: () => void;
  disabled: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group/c relative overflow-hidden rounded-xl border text-left",
        "transition-[transform,border-color] duration-200",
        "hover:-translate-y-1 active:scale-[0.98] disabled:opacity-60",
      )}
      style={{
        borderColor: highlight
          ? "var(--glass-border-strong)"
          : "var(--glass-border)",
        background: color ?? "var(--glass-1)",
      }}
    >
      <span className="relative block aspect-[2/3] w-full">
        {cover && (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 640px) 44vw, 220px"
            className="object-cover transition-transform duration-500 group-hover/c:scale-105"
          />
        )}
        <span
          className="absolute inset-x-0 bottom-0 block h-3/5"
          style={{
            background:
              "linear-gradient(to top, oklch(0 0 0 / 0.92), oklch(0 0 0 / 0.4) 50%, transparent)",
          }}
        />
        <span className="absolute inset-x-2.5 bottom-2.5 block">
          <span className="axis-caps block text-white/60">{caption}</span>
          <span className="mt-1 line-clamp-2 block text-[13px] leading-snug font-bold text-white">
            {name}
          </span>
        </span>
      </span>
    </button>
  );
}

function Progress({ placement }: { placement: Placement }) {
  // Total is an estimate that can only shrink, so show answered vs. answered +
  // remaining rather than a fixed denominator that might lie.
  const total = placement.asked + Math.max(1, estimateRemaining(placement));

  return (
    <div className="mt-5 flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 rounded-full transition-all duration-300",
            i < placement.asked ? "w-6 bg-[var(--text-secondary)]" : "w-1.5 bg-[var(--glass-border-strong)]",
          )}
        />
      ))}
    </div>
  );
}

function estimateRemaining(p: Placement) {
  const span = p.hi - p.lo;
  return span <= 1 ? 0 : Math.ceil(Math.log2(span));
}

function SeedStep({
  value,
  onChange,
  cover,
  coverColor,
}: {
  value: number;
  onChange: (v: number) => void;
  cover: string | null;
  coverColor: string | null;
}) {
  return (
    <div className="flex items-center gap-5">
      <div
        className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg"
        style={{ background: coverColor ?? "var(--glass-1)" }}
      >
        {cover && (
          <Image src={cover} alt="" fill sizes="80px" className="object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <span
          className="numeral block text-6xl leading-none"
          style={{ color: scoreColor(value) }}
        >
          {formatScore(value)}
        </span>

        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Score out of 10"
          className="mt-4 w-full accent-[var(--accent)]"
          style={{ accentColor: scoreColor(value) }}
        />
        <div className="text-fg-3 mt-1 flex justify-between text-[10px] tabular-nums">
          <span>0.1</span>
          <span>10.0</span>
        </div>
      </div>
    </div>
  );
}

function RemoveButton({
  onClick,
  busy,
  wide,
}: {
  onClick: () => void;
  busy: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "text-fg-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium",
        "transition-colors hover:text-[var(--danger)] disabled:opacity-50",
        wide && "w-full",
      )}
    >
      <Trash2 className="size-4" />
      Remove rating
    </button>
  );
}

/** Tiny confirmation tick used by callers that render their own trigger. */
export function SavedTick() {
  return <Check className="size-3.5 text-[var(--success)]" />;
}
