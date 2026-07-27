import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProgressStepper } from "@/components/library/progress-stepper";
import { GlassPanel } from "@/components/ui/glass-panel";
import type { ContinueRow } from "@/lib/queries";
import {
  countdown,
  displayTitle,
  isReadable,
  mediaAccent,
  totalUnits,
} from "@/lib/utils";

/**
 * Where you were.
 *
 * Every other section on this page is about finding something new; this one
 * exists so the answer to "what was I watching" is above the fold and one tap
 * from done. The +1 is the same stepper as the library page — optimistic,
 * coalesced — so an episode can be logged from the home page without ever
 * loading another route.
 */
export function ContinueWatching({
  rows,
  now,
}: {
  rows: ContinueRow[];
  /** One reference instant for every "next episode" countdown in the list. */
  now: number;
}) {
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="continue-heading" className="min-w-0">
      <header className="mb-3.5 flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-7 w-[3px] shrink-0 rounded-pill sm:h-8"
            style={{
              background: "var(--accent)",
              boxShadow: "0 0 14px -2px var(--accent)",
            }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="axis-caps text-fg-3 mb-0.5">Pick up where you left off</p>
            <h2
              id="continue-heading"
              className="truncate text-lg font-bold tracking-[-0.02em] sm:text-xl"
            >
              Continue
            </h2>
          </div>
        </div>

        <Link
          href="/library"
          className="glass-subtle specular glass-press text-fg-2 hover:text-fg group/all inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-semibold"
        >
          Library
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover/all:translate-x-0.5" />
        </Link>
      </header>

      <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <ContinueCard key={row.title_id} row={row} now={now} />
        ))}
      </ul>
    </section>
  );
}

function ContinueCard({ row, now }: { row: ContinueRow; now: number }) {
  const title = row.titles;
  const total = totalUnits(title);
  const accent = mediaAccent(title.media_type);
  const pct = total ? Math.min(100, (row.progress / total) * 100) : 0;
  const unit = isReadable(title.media_type) ? "Chapter" : "Episode";

  const nextAt = title.next_airing_at ? new Date(title.next_airing_at) : null;
  const soon = nextAt && nextAt.getTime() > now ? nextAt : null;

  return (
    <li style={{ "--art": title.cover_color ?? accent } as React.CSSProperties}>
      <GlassPanel
        level="subtle"
        radius="md"
        className="art-glow relative flex items-center gap-3 p-2.5"
      >
        {/* Progress as a fill behind the row — same language as the library. */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
          aria-hidden
        >
          <div
            className="h-full opacity-[0.13]"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>

        <Link
          href={`/title/${title.id}`}
          className="relative h-[4.25rem] w-12 shrink-0 overflow-hidden rounded-xs"
          style={{ background: title.cover_color ?? "var(--bg-base)" }}
        >
          {title.cover_image_large && (
            <Image
              src={title.cover_image_large}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          )}
        </Link>

        <div className="relative min-w-0 flex-1">
          <Link
            href={`/title/${title.id}`}
            className="hover:text-fg-2 line-clamp-1 text-[13px] font-semibold tracking-tight transition-colors"
          >
            {displayTitle(title)}
          </Link>

          <p className="text-fg-3 mt-0.5 text-[11px] tabular-nums">
            {unit} {row.progress}
            {total ? ` of ${total}` : ""}
            {row.status === "repeating" && " · rewatch"}
          </p>

          {soon && title.next_airing_ep != null && (
            <p
              className="mt-1 text-[11px] font-semibold tabular-nums"
              style={{
                color: `color-mix(in oklch, ${accent} 72%, var(--text-primary))`,
              }}
            >
              EP {title.next_airing_ep} in {countdown(soon, now)}
            </p>
          )}

          <ProgressStepper
            titleId={title.id}
            mediaType={title.media_type}
            total={total}
            progress={row.progress}
            size="sm"
            className="mt-2"
          />
        </div>
      </GlassPanel>
    </li>
  );
}
