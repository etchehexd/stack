"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import type { SearchResult } from "@/lib/types/database";
import {
  cn,
  displayTitle,
  formatLabel,
  mediaAccent,
  MEDIA_LABEL_SINGULAR,
} from "@/lib/utils";

/**
 * Typo-tolerant nav search. Hits the `search_titles` RPC directly from the
 * browser (it's `security definer` + granted to anon, and reads public data
 * only), which keeps keystroke latency down.
 */
export function QuickSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the field.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Debounced search. Nothing is set synchronously here — a too-short query is
  // handled by `visibleResults` below rather than by clearing state.
  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_titles", {
        p_query: trimmed,
        p_sort: "relevance",
        p_limit: 7,
      });

      if (cancelled) return;
      if (error) {
        console.error("[quick-search]", error.message);
        setResults([]);
      } else {
        setResults((data as SearchResult[]) ?? []);
        setHighlight(0);
      }
      setLoading(false);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // A query shorter than 2 characters has no results by definition — derive
  // that rather than clearing state from inside the effect.
  const visibleResults = query.trim().length >= 2 ? results : [];

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, visibleResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = visibleResults[highlight];
      if (picked) {
        router.push(`/title/${picked.id}`);
      } else if (query.trim()) {
        router.push(`/discover?q=${encodeURIComponent(query.trim())}`);
      }
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1 sm:max-w-xs">
      <div className="glass-subtle specular flex h-9 items-center gap-2 rounded-pill px-3">
        {loading ? (
          <Loader2 className="text-fg-3 size-4 shrink-0 animate-spin" />
        ) : (
          <Search className="text-fg-3 size-4 shrink-0" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          type="search"
          placeholder="Search titles…"
          aria-label="Search titles"
          autoComplete="off"
          className="placeholder:text-fg-3 min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="text-fg-3 border-hairline hidden rounded border px-1.5 py-0.5 font-sans text-[10px] lg:inline">
          ⌘K
        </kbd>
      </div>

      <AnimatePresence>
        {open && query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="glass-heavy specular absolute top-11 right-0 left-0 z-50 origin-top overflow-hidden rounded-lg p-1.5 max-sm:fixed max-sm:right-4 max-sm:left-4"
          >
            {visibleResults.length === 0 && !loading && (
              <p className="text-fg-3 px-3 py-4 text-center text-sm">
                No titles matched &ldquo;{query.trim()}&rdquo;.
              </p>
            )}

            {visibleResults.map((result, i) => (
              <Link
                key={result.id}
                href={`/title/${result.id}`}
                onClick={() => setOpen(false)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex items-center gap-3 rounded-sm p-2 transition-colors",
                  i === highlight && "bg-[var(--glass-2)]",
                )}
              >
                <div className="bg-bg-base relative h-14 w-10 shrink-0 overflow-hidden rounded-xs">
                  {result.cover_image_large && (
                    <Image
                      src={result.cover_image_large}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayTitle(result)}</p>
                  <p className="text-fg-3 mt-0.5 flex items-center gap-1.5 text-xs">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: mediaAccent(result.media_type) }}
                    />
                    {MEDIA_LABEL_SINGULAR[result.media_type]}
                    <span aria-hidden>·</span>
                    {formatLabel(result.format)}
                    {result.season_year && (
                      <>
                        <span aria-hidden>·</span>
                        {result.season_year}
                      </>
                    )}
                  </p>
                </div>
              </Link>
            ))}

            {visibleResults.length > 0 && (
              <Link
                href={`/discover?q=${encodeURIComponent(query.trim())}`}
                onClick={() => setOpen(false)}
                className="text-fg-3 hover:text-fg border-hairline mt-1 block border-t px-3 py-2.5 text-center text-xs transition-colors"
              >
                See all results for &ldquo;{query.trim()}&rdquo;
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
