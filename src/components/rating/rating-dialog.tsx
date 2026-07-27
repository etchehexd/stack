"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Flame, Loader2, Meh, ThumbsDown, Trash2, Undo2, X } from "lucide-react";

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

const BUCKET_ICON = { loved: Flame, fine: Meh, bad: ThumbsDown } as const;

const EMPTY_SUBSCRIBE = () => () => {};

/** True once React has hydrated — there is no document to portal into before. */
function useHydrated() {
  return React.useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  );
}

/**
 * The rating flow.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS RENDERS INTO <body>. IT MUST.
 *
 * It used to be a `position: fixed` div sitting wherever it was mounted — which
 * is inside the title page's action bar, a GlassPanel carrying `specular`, and
 * `specular` sets `isolation: isolate`. That makes the panel a stacking
 * context, so the dialog's z-index only ordered it against that panel's own
 * children: every panel further down the page painted straight over it and the
 * dialog became unclickable. Same failure, same fix, as ui/popover.tsx.
 *
 * Never take the portal out.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Three screens at most and one question on screen at a time. The whole point
 * of a comparative system is that each individual decision is trivial — putting
 * two of them side by side would undo that.
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
  const hydrated = useHydrated();
  const seeding = ratedCount < SEED_TARGET;

  const [stage, setStage] = React.useState<Stage>(seeding ? "seed" : "bucket");
  const [bucket, setBucket] = React.useState<Bucket | null>(null);
  const [items, setItems] = React.useState<BucketItem[]>([]);
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  /** Every earlier placement, so a misread duel can be taken back. */
  const [history, setHistory] = React.useState<Placement[]>([]);
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
      setHistory([]);
      setSeedValue(currentScore ?? 7.0);
      setError(null);
      setFinalScore(null);
      setBusy(false);
    }
  }

  const finish = React.useCallback(
    (score: number) => {
      setFinalScore(score);
      setStage("done");
      router.refresh();
      // Long enough to read the number, short enough not to be a wait.
      setTimeout(onClose, 1400);
    },
    [router, onClose],
  );

  const commit = React.useCallback(
    async (target: Bucket, position: number) => {
      setBusy(true);
      const result = await placeRating({ titleId, bucket: target, position });
      setBusy(false);
      if (!result.ok) {
        setError(result.error ?? "Could not save that.");
        return;
      }
      finish(result.score ?? 0);
    },
    [titleId, finish],
  );

  const chooseBucket = React.useCallback(
    async (next: Bucket) => {
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
      setHistory([]);
      setStage("compare");
    },
    [commit],
  );

  const answer = React.useCallback(
    async (preferredNew: boolean) => {
      if (!placement || !bucket || busy) return;
      const next = advance(placement, preferredNew);
      setHistory((prev) => [...prev, placement]);
      setPlacement(next);
      if (placementDone(next)) await commit(bucket, placementResult(next));
    },
    [placement, bucket, busy, commit],
  );

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((prev) => prev.slice(0, -1));
    setPlacement(previous);
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

  /* Keyboard: the whole flow is playable without the mouse. 1/2/3 pick a
     bucket, ←/→ answer a duel, backspace takes the last answer back. */
  React.useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (stage === "bucket" && !busy) {
        const index = ["1", "2", "3"].indexOf(e.key);
        if (index >= 0) {
          e.preventDefault();
          void chooseBucket(BUCKET_ORDER[index]);
        }
      }
      if (stage === "compare" && !busy) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          void answer(true);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          void answer(false);
        } else if (e.key === "Backspace") {
          e.preventDefault();
          undo();
        }
      }
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // `undo` is stable enough for this handler's lifetime — it only reads state
    // through setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, stage, busy, chooseBucket, answer]);

  if (!hydrated || !open) return null;

  const opponent =
    placement && !placementDone(placement) ? items[pivotIndex(placement)] : null;

  // The dialog wears the colour of wherever the rating is heading: the chosen
  // bucket, or the score once there is one.
  const aura =
    finalScore != null
      ? scoreColor(finalScore)
      : bucket
        ? BUCKETS[bucket].color
        : stage === "seed"
          ? scoreColor(seedValue)
          : (coverColor ?? "var(--accent)");

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6"
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
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 34 }}
        className={cn(
          "glass-heavy specular scroll-glass relative w-full max-w-xl overflow-hidden",
          "max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl",
        )}
        style={{
          borderColor: `color-mix(in oklch, ${aura} 30%, var(--glass-border))`,
        }}
      >
        {/* The aura. A wash of the current colour bleeding down from the top
            edge — the dialog visibly changes temperature as you answer. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 transition-colors duration-500"
          style={{
            background: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklch, ${aura} 30%, transparent) 0%, transparent 70%)`,
          }}
          aria-hidden
        />

        <header className="relative flex items-center gap-3.5 p-4 sm:p-5">
          <div
            className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md"
            style={{
              background: coverColor ?? "var(--glass-1)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {cover && (
              <Image src={cover} alt="" fill sizes="44px" className="object-cover" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="axis-caps" style={{ color: aura }}>
              {stage === "done"
                ? "Rated"
                : stage === "seed"
                  ? `Rating ${Math.min(ratedCount + 1, SEED_TARGET)} of ${SEED_TARGET}`
                  : stage === "compare"
                    ? "Which did you prefer?"
                    : "How was it?"}
            </p>
            <h2 className="mt-1 line-clamp-2 text-[15px] leading-snug font-bold tracking-tight">
              {titleName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-fg-3 hover:text-fg glass-subtle glass-press grid size-8 shrink-0 place-items-center rounded-full"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="relative p-4 pt-0 sm:p-5 sm:pt-0">
          <AnimatePresence mode="wait">
            {stage === "seed" && (
              <Step key="seed">
                <SeedStep value={seedValue} onChange={setSeedValue} />
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
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold tracking-tight text-[oklch(0.16_0.02_265)] transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: scoreColor(seedValue),
                      boxShadow: `0 10px 30px -12px ${scoreColor(seedValue)}`,
                    }}
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Save {formatScore(seedValue)}
                  </button>
                  {currentScore != null && (
                    <RemoveButton onClick={remove} busy={busy} />
                  )}
                </div>
              </Step>
            )}

            {stage === "bucket" && (
              <Step key="bucket">
                <div className="flex flex-col gap-2.5">
                  {BUCKET_ORDER.map((key, i) => {
                    const meta = BUCKETS[key];
                    const Icon = BUCKET_ICON[key];
                    const isCurrent = bucketOf(currentScore) === key;
                    const loading = busy && bucket === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={busy}
                        onClick={() => chooseBucket(key)}
                        className={cn(
                          "group/b relative flex items-center gap-4 overflow-hidden rounded-xl border p-4 text-left",
                          "transition-[transform,border-color,background] duration-200",
                          "hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-60",
                        )}
                        style={{
                          borderColor: `color-mix(in oklch, ${meta.color} ${isCurrent ? 60 : 24}%, transparent)`,
                          background: `linear-gradient(100deg, color-mix(in oklch, ${meta.color} ${isCurrent ? 20 : 10}%, transparent) 0%, var(--glass-1) 70%)`,
                        }}
                      >
                        <span
                          className="grid size-11 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover/b:scale-110"
                          style={{
                            background: `color-mix(in oklch, ${meta.color} 22%, transparent)`,
                            color: meta.color,
                            boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${meta.color} 35%, transparent)`,
                          }}
                        >
                          {loading ? (
                            <Loader2 className="size-5 animate-spin" />
                          ) : (
                            <Icon className="size-5" strokeWidth={2.2} />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span
                            className="flex items-center gap-2 text-[15px] font-bold tracking-tight"
                            style={{ color: meta.color }}
                          >
                            {meta.label}
                            {isCurrent && (
                              <span className="axis-caps text-fg-3">current</span>
                            )}
                          </span>
                          <span className="text-fg-3 mt-0.5 block text-xs">
                            {meta.blurb}
                          </span>
                        </span>

                        <kbd className="text-fg-3 border-hairline hidden size-6 shrink-0 place-items-center rounded-md border font-sans text-[11px] sm:grid">
                          {i + 1}
                        </kbd>
                      </button>
                    );
                  })}
                </div>

                <p className="text-fg-3 mt-4 text-center text-[11px] leading-relaxed">
                  Pick a shelf. Stack works out the number by asking you to
                  compare it with things you&rsquo;ve already rated.
                </p>

                {currentScore != null && (
                  <div className="mt-2 flex justify-center">
                    <RemoveButton onClick={remove} busy={busy} wide />
                  </div>
                )}
              </Step>
            )}

            {stage === "compare" && opponent && placement && bucket && (
              <Step key={`compare-${placement.asked}`}>
                <div className="relative grid grid-cols-2 gap-3">
                  <Contender
                    name={titleName}
                    cover={cover}
                    color={coverColor}
                    caption="The new one"
                    hint="←"
                    onClick={() => answer(true)}
                    disabled={busy}
                    accent={BUCKETS[bucket].color}
                  />
                  <Contender
                    name={opponent.name}
                    cover={opponent.cover}
                    color={opponent.color}
                    caption="Already rated"
                    hint="→"
                    score={opponent.score}
                    onClick={() => answer(false)}
                    disabled={busy}
                  />

                  <span
                    className="numeral pointer-events-none absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] tracking-[0.08em]"
                    style={{
                      background: "var(--glass-3)",
                      border: "1px solid var(--glass-border-strong)",
                      boxShadow: "var(--shadow-lift)",
                    }}
                    aria-hidden
                  >
                    VS
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={history.length === 0 || busy}
                    className="text-fg-3 hover:text-fg inline-flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-0"
                  >
                    <Undo2 className="size-3.5" />
                    Undo
                  </button>

                  <Progress placement={placement} />

                  <span className="text-fg-3 w-12 text-right text-xs tabular-nums">
                    {busy ? <Loader2 className="ml-auto size-3.5 animate-spin" /> : null}
                  </span>
                </div>
              </Step>
            )}

            {stage === "done" && finalScore != null && (
              <Step key="done">
                <div className="flex flex-col items-center py-7">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 17 }}
                    className="relative grid size-32 place-items-center"
                  >
                    <ScoreRing value={finalScore} />
                    <span
                      className="numeral relative text-5xl leading-none"
                      style={{ color: scoreColor(finalScore) }}
                    >
                      {formatScore(finalScore)}
                    </span>
                  </motion.div>

                  <span
                    className="axis-caps mt-4"
                    style={{ color: scoreColor(finalScore) }}
                  >
                    {BUCKETS[bucketOf(finalScore)!].label}
                  </span>
                  <p className="text-fg-3 mt-2 text-center text-xs">
                    Your list re-sorted itself around it.
                  </p>
                </div>
              </Step>
            )}
          </AnimatePresence>

          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */

function Step({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -14 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** The dial behind the final score. Same language as the badge on a poster. */
function ScoreRing({ value }: { value: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const color = scoreColor(value);

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth="6"
        stroke="var(--glass-1)"
      />
      <motion.circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        stroke={color}
        initial={{ strokeDasharray: `0 ${c}` }}
        animate={{ strokeDasharray: `${(value / 10) * c} ${c}` }}
        transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
        style={{ filter: `drop-shadow(0 0 8px color-mix(in oklch, ${color} 60%, transparent))` }}
      />
    </svg>
  );
}

function Contender({
  name,
  cover,
  color,
  caption,
  hint,
  score,
  onClick,
  disabled,
  accent,
}: {
  name: string;
  cover: string | null;
  color: string | null;
  caption: string;
  hint: string;
  score?: number;
  onClick: () => void;
  disabled: boolean;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group/c relative overflow-hidden rounded-xl border text-left",
        "transition-[transform,border-color,box-shadow] duration-200",
        "hover:-translate-y-1 active:scale-[0.98] disabled:opacity-60",
        "hover:shadow-[var(--shadow-lift)]",
      )}
      style={{
        borderColor: accent
          ? `color-mix(in oklch, ${accent} 45%, transparent)`
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
            sizes="(max-width: 640px) 44vw, 240px"
            className="object-cover transition-transform duration-500 group-hover/c:scale-105"
          />
        )}

        <span
          className="absolute inset-x-0 bottom-0 block h-3/5"
          style={{
            background:
              "linear-gradient(to top, oklch(0 0 0 / 0.94), oklch(0 0 0 / 0.45) 48%, transparent)",
          }}
        />

        {score != null && (
          <span
            className="numeral absolute top-2 right-2 rounded-pill px-2 py-0.5 text-[12px]"
            style={{
              background: "oklch(0.14 0.02 265 / 0.82)",
              color: scoreColor(score),
              border: "1px solid oklch(1 0 0 / 0.14)",
            }}
          >
            {formatScore(score)}
          </span>
        )}

        <span className="absolute inset-x-2.5 bottom-2.5 block">
          <span className="axis-caps flex items-center gap-1.5 text-white/60">
            <span className="hidden sm:inline">{hint}</span>
            {caption}
          </span>
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
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 rounded-full transition-all duration-300",
            i < placement.asked
              ? "w-6 bg-[var(--text-secondary)]"
              : "w-1.5 bg-[var(--glass-border-strong)]",
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

/**
 * Direct entry, used only for the first ten ratings. The dial is the same
 * shape as the one the flow ends on, so the two modes feel like one product.
 */
function SeedStep({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const color = scoreColor(value);

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid size-32 place-items-center">
        <ScoreRing value={value} />
        <span className="numeral relative text-5xl leading-none" style={{ color }}>
          {formatScore(value)}
        </span>
      </div>

      <input
        type="range"
        min={0.1}
        max={10}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Score out of 10"
        className="mt-6 w-full"
        style={{ accentColor: color }}
      />

      <div className="mt-3 flex w-full justify-center gap-1.5">
        {[2, 4, 5, 6, 7, 8, 9, 10].map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => onChange(quick)}
            className={cn(
              "numeral h-8 w-9 rounded-lg text-xs transition-[background,color,transform] duration-150 active:scale-95",
              Math.abs(value - quick) < 0.05
                ? "text-[oklch(0.16_0.02_265)]"
                : "glass-subtle text-fg-2 hover:text-fg",
            )}
            style={
              Math.abs(value - quick) < 0.05
                ? { background: scoreColor(quick) }
                : undefined
            }
          >
            {quick}
          </button>
        ))}
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
