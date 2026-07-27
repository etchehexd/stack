"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  TriStateChip,
  applyTriState,
  parseTriSet,
  serializeTriSet,
  triSetSize,
  triStateOf,
  type TriState,
  type TriStateSet,
} from "@/components/ui/tri-state-chip";
import type { MediaType } from "@/lib/types/database";
import {
  MEDIA_LABEL,
  SEASONS,
  cn,
  formatLabel,
  mediaAccent,
  titleCase,
} from "@/lib/utils";

export interface FacetOption {
  value: string;
  count: number;
}

export interface DiscoverFiltersProps {
  facets: {
    genres: FacetOption[];
    studios: FacetOption[];
    authors: FacetOption[];
    formats: FacetOption[];
  };
  total: number;
}

const STATUSES = ["RELEASING", "FINISHED", "NOT_YET_RELEASED", "HIATUS", "CANCELLED"];
const MEDIA: MediaType[] = ["anime", "manga", "light_novel"];

const SORTS = [
  { value: "popularity", label: "Popularity" },
  { value: "score", label: "Community score" },
  { value: "newest", label: "Newest" },
  { value: "title", label: "A–Z" },
];

/**
 * Discover's filter surface. All state lives in the URL, so any filtered view
 * is shareable and the back button behaves.
 *
 * Genres, formats, statuses and studios/authors are all TRI-STATE:
 * click → include, click → exclude, click → clear.
 */
export function DiscoverFilters({ facets, total }: DiscoverFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [expanded, setExpanded] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const urlQuery = params.get("q") ?? "";
  const [queryDraft, setQueryDraft] = React.useState(urlQuery);

  // Keep the field in sync when the URL changes from elsewhere (e.g. the nav
  // search). Adjusting during render beats an effect: no extra render pass.
  const [lastUrlQuery, setLastUrlQuery] = React.useState(urlQuery);
  if (lastUrlQuery !== urlQuery) {
    setLastUrlQuery(urlQuery);
    setQueryDraft(urlQuery);
  }

  const genres = parseTriSet(params.get("genres"));
  const formats = parseTriSet(params.get("formats"));
  const statuses = parseTriSet(params.get("status"));
  const people = parseTriSet(params.get("people"));
  const media = (params.get("media")?.split(",").filter(Boolean) ?? []) as MediaType[];

  const activeCount =
    triSetSize(genres) +
    triSetSize(formats) +
    triSetSize(statuses) +
    triSetSize(people) +
    media.length +
    (params.get("season") ? 1 : 0) +
    (params.get("year_min") || params.get("year_max") ? 1 : 0) +
    (params.get("score_min") ? 1 : 0);

  const update = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete("page"); // any filter change resets pagination
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  function setTriSet(key: string, set: TriStateSet, value: string, state: TriState) {
    const updated = applyTriState(set, value, state);
    update((next) => {
      const serialized = serializeTriSet(updated);
      if (serialized) next.set(key, serialized);
      else next.delete(key);
    });
  }

  // Debounced free-text search.
  React.useEffect(() => {
    if (queryDraft === urlQuery) return;
    const timer = setTimeout(() => {
      update((next) => {
        if (queryDraft.trim()) next.set("q", queryDraft.trim());
        else next.delete("q");
      });
    }, 350);
    return () => clearTimeout(timer);
    // `update` and `params` change identity every render; the guard above is
    // what actually prevents a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDraft]);

  function reset() {
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    // `heavy` because this floats above a scrolling grid of cover art — a
    // lighter fill lets the artwork read through and looks like a rendering bug.
    <GlassPanel level="heavy" radius="xl" className="sticky top-20 z-20 p-4">
      {/* --- Row 1: search + media type + sort ----------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="glass-subtle specular flex h-10 min-w-0 flex-1 items-center gap-2 rounded-pill px-3.5 sm:max-w-sm">
          <Search className="text-fg-3 size-4 shrink-0" />
          <input
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            type="search"
            placeholder="Search — typos are fine"
            aria-label="Search titles"
            className="placeholder:text-fg-3 min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {MEDIA.map((type) => {
            const active = media.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() =>
                  update((next) => {
                    const set = new Set(media);
                    if (active) set.delete(type);
                    else set.add(type);
                    if (set.size) next.set("media", [...set].join(","));
                    else next.delete("media");
                  })
                }
                aria-pressed={active}
                className={cn(
                  "h-8 rounded-pill border px-3 text-xs font-medium transition-all duration-200",
                  active
                    ? "border-transparent text-white"
                    : "glass-subtle border-hairline text-fg-2 hover:text-fg",
                )}
                style={
                  active
                    ? {
                        background: `color-mix(in oklch, ${mediaAccent(type)} 80%, transparent)`,
                        boxShadow: `0 4px 14px -6px ${mediaAccent(type)}`,
                      }
                    : undefined
                }
              >
                {MEDIA_LABEL[type]}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={params.get("sort") ?? "popularity"}
            onChange={(e) =>
              update((next) => {
                if (e.target.value === "popularity") next.delete("sort");
                else next.set("sort", e.target.value);
              })
            }
            aria-label="Sort results"
            className="glass-subtle h-8 rounded-pill px-3 text-xs font-medium outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={cn(activeCount > 0 && "border-[var(--accent)]")}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="ml-0.5 rounded-pill bg-[var(--accent)] px-1.5 text-[10px] text-white tabular-nums">
                {activeCount}
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </Button>
        </div>
      </div>

      {/* --- Row 2: the tri-state chip banks -------------------------------- */}
      {expanded && (
        <div className="border-hairline mt-4 space-y-4 border-t pt-4">
          <p className="text-fg-3 text-xs">
            Click a chip to <span className="text-fg-2 font-medium">include</span> it,
            again to <span className="text-[var(--danger)] font-medium">exclude</span>{" "}
            it, again to clear. Right-click clears instantly.
          </p>

          <ChipBank
            label="Genres"
            options={facets.genres}
            set={genres}
            onChange={(v, s) => setTriSet("genres", genres, v, s)}
          />

          <ChipBank
            label="Format"
            options={facets.formats}
            set={formats}
            renderLabel={formatLabel}
            onChange={(v, s) => setTriSet("formats", formats, v, s)}
          />

          <ChipBank
            label="Status"
            options={STATUSES.map((value) => ({ value, count: 0 }))}
            set={statuses}
            showCounts={false}
            renderLabel={(v) => titleCase(v)}
            onChange={(v, s) => setTriSet("status", statuses, v, s)}
          />

          <ChipBank
            label="Studio / Author"
            options={[...facets.studios, ...facets.authors]}
            set={people}
            collapsible
            onChange={(v, s) => setTriSet("people", people, v, s)}
          />

          {/* --- Ranges ---------------------------------------------------- */}
          <div className="grid gap-4 sm:grid-cols-3">
            <RangeField
              label="Year"
              minValue={params.get("year_min") ?? ""}
              maxValue={params.get("year_max") ?? ""}
              min={1940}
              max={new Date().getFullYear() + 2}
              onChange={(which, value) =>
                update((next) => {
                  const key = which === "min" ? "year_min" : "year_max";
                  if (value) next.set(key, value);
                  else next.delete(key);
                })
              }
            />

            <RangeField
              label="Episodes / chapters"
              minValue={params.get("count_min") ?? ""}
              maxValue={params.get("count_max") ?? ""}
              min={1}
              max={5000}
              onChange={(which, value) =>
                update((next) => {
                  const key = which === "min" ? "count_min" : "count_max";
                  if (value) next.set(key, value);
                  else next.delete(key);
                })
              }
            />

            <div>
              <p className="text-fg-2 mb-2 text-xs font-medium">Community score</p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={params.get("score_min") ?? "0"}
                  onChange={(e) =>
                    update((next) => {
                      if (e.target.value === "0") next.delete("score_min");
                      else next.set("score_min", e.target.value);
                    })
                  }
                  aria-label="Minimum community score"
                  className="accent-[var(--accent)] flex-1"
                />
                <span className="text-fg-3 w-12 text-right text-xs tabular-nums">
                  {params.get("score_min") ?? 0}%+
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-fg-2 text-xs font-medium">Season</p>
            {SEASONS.map((season) => {
              const active = params.get("season") === season;
              return (
                <button
                  key={season}
                  type="button"
                  onClick={() =>
                    update((next) => {
                      if (active) next.delete("season");
                      else next.set("season", season);
                    })
                  }
                  aria-pressed={active}
                  className={cn(
                    "h-7 rounded-pill border px-3 text-xs font-medium transition-colors",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "glass-subtle border-hairline text-fg-2 hover:text-fg",
                  )}
                >
                  {titleCase(season)}
                </button>
              );
            })}
          </div>

          <div className="border-hairline flex items-center justify-between border-t pt-3">
            <p className="text-fg-3 text-xs tabular-nums">
              {pending ? "Filtering…" : `${total.toLocaleString()} titles match`}
            </p>
            {activeCount > 0 && (
              <Button size="sm" variant="ghost" onClick={reset}>
                <RotateCcw className="size-3.5" />
                Reset all
              </Button>
            )}
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

function ChipBank({
  label,
  options,
  set,
  onChange,
  renderLabel,
  showCounts = true,
  collapsible = false,
}: {
  label: string;
  options: FacetOption[];
  set: TriStateSet;
  onChange: (value: string, state: TriState) => void;
  renderLabel?: (value: string) => string;
  showCounts?: boolean;
  collapsible?: boolean;
}) {
  const [showAll, setShowAll] = React.useState(false);
  if (options.length === 0) return null;

  const limit = collapsible && !showAll ? 12 : options.length;
  const visible = options.slice(0, limit);

  // Anything already selected must stay visible even when collapsed.
  const selected = [...set.include, ...set.exclude];
  const extras = options.filter(
    (o) => selected.includes(o.value) && !visible.some((v) => v.value === o.value),
  );

  return (
    <div>
      <p className="text-fg-2 mb-2 text-xs font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {[...visible, ...extras].map((option) => (
          <TriStateChip
            key={option.value}
            label={renderLabel ? renderLabel(option.value) : option.value}
            state={triStateOf(set, option.value)}
            count={showCounts && option.count ? option.count : undefined}
            onChange={(state) => onChange(option.value, state)}
          />
        ))}

        {collapsible && options.length > 12 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-fg-3 hover:text-fg h-8 rounded-pill px-2 text-xs font-medium transition-colors"
          >
            {showAll ? "Show fewer" : `+${options.length - 12} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function RangeField({
  label,
  minValue,
  maxValue,
  min,
  max,
  onChange,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  min: number;
  max: number;
  onChange: (which: "min" | "max", value: string) => void;
}) {
  return (
    <div>
      <p className="text-fg-2 mb-2 text-xs font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          placeholder="min"
          aria-label={`${label} minimum`}
          value={minValue}
          min={min}
          max={max}
          onChange={(e) => onChange("min", e.target.value)}
          className="glass-subtle placeholder:text-fg-3 h-8 w-full min-w-0 rounded-sm px-2.5 text-xs outline-none"
        />
        <span className="text-fg-3 text-xs">–</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="max"
          aria-label={`${label} maximum`}
          value={maxValue}
          min={min}
          max={max}
          onChange={(e) => onChange("max", e.target.value)}
          className="glass-subtle placeholder:text-fg-3 h-8 w-full min-w-0 rounded-sm px-2.5 text-xs outline-none"
        />
      </div>
    </div>
  );
}
