"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { loadMoreTitles, type LoadMoreInput } from "./actions";
import { TitleCard } from "@/components/title/title-card";
import type { SearchResult } from "@/lib/types/database";

export interface DiscoverResultsProps {
  /** The first page, rendered on the server. */
  initial: SearchResult[];
  total: number;
  /** The filters these results came from, for asking for the next slice. */
  params: Omit<LoadMoreInput, "offset" | "limit">;
  pageSize: number;
  /** Every score the viewer has given, keyed by title id. */
  ratings: Record<string, number>;
}

/**
 * The results grid, which keeps going.
 *
 * Pagination made the page a series of dead ends: you'd scroll a screenful of
 * covers, hit a "Next" button, jump to the top of a fresh page and lose your
 * place. Browsing a catalog is a scroll, not a sequence of documents — so the
 * next slice is fetched a screen and a half before you reach the bottom and
 * appended in place.
 *
 * The first page still comes from the server, so the page is complete and
 * indexable on arrival; only the continuation is client-side.
 */
export function DiscoverResults({
  initial,
  total,
  params,
  pageSize,
  ratings,
}: DiscoverResultsProps) {
  const [extra, setExtra] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // A new first page means the filters changed — start over. Adjusting during
  // render off a changed prop beats an effect: no flash of the old results.
  const [lastInitial, setLastInitial] = React.useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setExtra([]);
    setFailed(false);
  }

  const items = React.useMemo(() => [...initial, ...extra], [initial, extra]);
  const exhausted = items.length >= total;

  const sentinel = React.useRef<HTMLDivElement>(null);
  // Guards against the observer firing again while a fetch is in flight.
  const busy = React.useRef(false);

  const loadMore = React.useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);

    const result = await loadMoreTitles({
      ...params,
      offset: initial.length + extra.length,
      limit: pageSize,
    });

    setLoading(false);
    busy.current = false;

    if (!result.ok) {
      setFailed(true);
      return;
    }

    // The catalog can shift under a long scroll; dropping ids we already have
    // keeps React keys unique and stops a row repeating itself.
    setExtra((prev) => {
      const seen = new Set([...initial, ...prev].map((r) => r.id));
      return [...prev, ...result.results.filter((r) => !seen.has(r.id))];
    });
  }, [params, initial, extra.length, pageSize]);

  React.useEffect(() => {
    const node = sentinel.current;
    if (!node || exhausted || failed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      // Start fetching well before the sentinel is on screen, so the grid
      // never actually runs out under a fast scroll.
      { rootMargin: "900px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [exhausted, failed, loadMore]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {items.map((result, i) => (
          <TitleCard
            key={result.id}
            title={result}
            score={ratings[result.id] ?? null}
            priority={i < 6}
          />
        ))}
      </div>

      <div ref={sentinel} className="flex justify-center py-8">
        {loading && (
          <span className="text-fg-3 inline-flex items-center gap-2 text-xs font-semibold">
            <Loader2 className="size-4 animate-spin" />
            Loading more
          </span>
        )}

        {!loading && failed && (
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              void loadMore();
            }}
            className="glass-subtle specular glass-press rounded-pill px-4 py-2 text-xs font-semibold"
          >
            Couldn&rsquo;t load more — try again
          </button>
        )}

        {!loading && !failed && exhausted && items.length > 0 && (
          <p className="text-fg-3 text-xs tabular-nums">
            That&rsquo;s all {total.toLocaleString()}.
          </p>
        )}
      </div>
    </>
  );
}
