"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bookmark } from "lucide-react";

import { cn, countdown } from "@/lib/utils";

export interface AiringItem {
  id: number;
  titleId: string;
  name: string;
  cover: string | null;
  art: string;
  accent: string;
  episode: number;
  airingAt: string;
  time: string;
  tracked: boolean;
}

/**
 * Today's episodes, counting down.
 *
 * This is the one thing on the page whose answer is different every single day,
 * which makes it the reason to open the app on a day you aren't looking for
 * anything in particular. The clock ticks client-side — a countdown that was
 * rendered at build time and says "in 3h" four hours later is worse than no
 * countdown at all — but it starts from the server's instant so the first paint
 * matches the markup exactly.
 *
 * Titles already in your library come forward: accent hairline, a bookmark, and
 * they sort ahead of everything else airing at the same time.
 */
const TICK_MS = 30_000;

/**
 * The wall clock, quantised to the tick so the snapshot is stable between
 * renders. Hydration takes the server's instant, so the first paint matches the
 * markup exactly and only then does the countdown catch up to the real clock.
 */
function useNow(serverNow: number) {
  return React.useSyncExternalStore(
    (onChange) => {
      const timer = setInterval(onChange, TICK_MS);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
    () => serverNow,
  );
}

export function AiringToday({
  items,
  now: serverNow,
}: {
  items: AiringItem[];
  now: number;
}) {
  const now = useNow(serverNow);

  if (items.length === 0) return null;

  const upcoming = items.filter((item) => new Date(item.airingAt).getTime() > now);

  return (
    <section aria-labelledby="airing-today-heading" className="min-w-0">
      <header className="mb-3.5 flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex size-2.5 shrink-0 items-center justify-center">
            <span
              className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
              style={{ background: "var(--success)" }}
            />
            <span
              className="relative inline-flex size-1.5 rounded-full"
              style={{ background: "var(--success)" }}
            />
          </span>
          <div className="min-w-0">
            <p className="axis-caps text-fg-3 mb-0.5">
              {upcoming.length > 0
                ? `${upcoming.length} still to come`
                : "All aired"}
            </p>
            <h2
              id="airing-today-heading"
              className="truncate text-lg font-bold tracking-[-0.02em] sm:text-xl"
            >
              Airing today
            </h2>
          </div>
        </div>

        <Link
          href="/calendar"
          className="glass-subtle specular glass-press text-fg-2 hover:text-fg group/all inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-semibold"
        >
          Full week
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover/all:translate-x-0.5" />
        </Link>
      </header>

      <ul className="shelf-fade no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pt-1 pb-2 sm:mx-0 sm:px-0">
        {items.map((item) => {
          const airsAt = new Date(item.airingAt).getTime();
          const aired = airsAt <= now;

          return (
            <li
              key={item.id}
              className="w-[16rem] shrink-0 snap-start sm:w-[17.5rem]"
              style={{ "--art": item.art } as React.CSSProperties}
            >
              <Link
                href={`/title/${item.titleId}`}
                className={cn(
                  "art-glow glass-subtle specular lift flex items-center gap-3 rounded-md p-2 transition-opacity",
                  aired && "opacity-55",
                )}
                style={
                  item.tracked
                    ? {
                        borderColor: `color-mix(in oklch, ${item.accent} 50%, transparent)`,
                      }
                    : undefined
                }
              >
                <span
                  className="relative h-16 w-11 shrink-0 overflow-hidden rounded-xs"
                  style={{ background: item.art }}
                >
                  {item.cover && (
                    <Image
                      src={item.cover}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {item.tracked && (
                      <Bookmark
                        className="size-3 shrink-0 fill-current"
                        style={{ color: item.accent }}
                        aria-label="In your library"
                      />
                    )}
                    <span className="line-clamp-1 text-[13px] font-semibold tracking-tight">
                      {item.name}
                    </span>
                  </span>

                  <span className="text-fg-3 mt-1 block text-[11px] tabular-nums">
                    Episode {item.episode} · {item.time}
                  </span>

                  <span
                    className="mt-1.5 inline-block rounded-pill px-2 py-0.5 text-[11px] font-bold tabular-nums"
                    style={{
                      background: aired
                        ? "var(--glass-1)"
                        : `color-mix(in oklch, ${item.accent} 22%, transparent)`,
                      // Mixing toward the foreground keeps the accent readable
                      // in BOTH themes — the media accents are single values,
                      // and at 0.72 lightness they're too pale on a light panel.
                      color: aired
                        ? "var(--text-tertiary)"
                        : `color-mix(in oklch, ${item.accent} 72%, var(--text-primary))`,
                    }}
                  >
                    {aired ? "aired" : `in ${countdown(item.airingAt, now)}`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
