"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

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
  { value: "score", label: "Rating" },
  { value: "newest", label: "Newest" },
  { value: "title", label: "A–Z" },
];

const EMPTY_SUBSCRIBE = () => () => {};

function useHydrated() {
  return React.useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  );
}

/** Reads a media query as a subscription, so it never sets state in an effect. */
function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Collapses the bar once you're reading results rather than searching them.
 *
 * Scrolling down means "show me more covers", so the search field, the media
 * chips and the sort control fold away and leave a slim strip; scrolling up —
 * or getting back near the top — means you're looking for the controls again,
 * and they come straight back.
 */
function useCollapseOnScroll() {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    let last = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      if (y < 160) setCollapsed(false);
      else if (y > last + 6) setCollapsed(true);
      else if (y < last - 6) setCollapsed(false);
      last = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return collapsed;
}

/**
 * Discover's filter surface. All state lives in the URL, so any filtered view
 * is shareable and the back button behaves.
 *
 * Chips update a local copy of the query string the instant they're pressed and
 * the real navigation follows in a transition. The URL is still the source of
 * truth — but a filter that waits for a server round trip before it looks
 * pressed feels broken, however fast the round trip is.
 */
export function DiscoverFilters({ facets, total }: DiscoverFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const collapsed = useCollapseOnScroll();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Optimistic mirror of the query string.
  const urlString = params.toString();
  const [draftUrl, setDraftUrl] = React.useState(urlString);
  const [lastUrl, setLastUrl] = React.useState(urlString);
  if (lastUrl !== urlString) {
    setLastUrl(urlString);
    setDraftUrl(urlString);
  }
  const view = React.useMemo(() => new URLSearchParams(draftUrl), [draftUrl]);

  const urlQuery = view.get("q") ?? "";
  const [queryDraft, setQueryDraft] = React.useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = React.useState(urlQuery);
  if (lastUrlQuery !== urlQuery) {
    setLastUrlQuery(urlQuery);
    setQueryDraft(urlQuery);
  }

  const genres = parseTriSet(view.get("genres"));
  const formats = parseTriSet(view.get("formats"));
  const statuses = parseTriSet(view.get("status"));
  const people = parseTriSet(view.get("people"));
  const media = (view.get("media")?.split(",").filter(Boolean) ?? []) as MediaType[];

  const activeCount =
    triSetSize(genres) +
    triSetSize(formats) +
    triSetSize(statuses) +
    triSetSize(people) +
    media.length +
    (view.get("season") ? 1 : 0) +
    (view.get("year_min") || view.get("year_max") ? 1 : 0) +
    (view.get("score_min") ? 1 : 0);

  const update = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(draftUrl);
      mutate(next);
      next.delete("page"); // any filter change resets the result window
      const serialized = next.toString();
      setDraftUrl(serialized);
      startTransition(() => {
        router.replace(`${pathname}?${serialized}`, { scroll: false });
      });
    },
    [draftUrl, pathname, router],
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
    // `update` changes identity every render; the guard above is what actually
    // prevents a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDraft]);

  function reset() {
    setDraftUrl("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  const showField = !collapsed || searchOpen || queryDraft.length > 0;

  return (
    <>
      {/* `heavy` because this floats above a scrolling grid of cover art — a
          lighter fill lets the artwork read through and looks like a bug. */}
      <GlassPanel
        level="heavy"
        radius="xl"
        className={cn(
          "sticky top-[4.25rem] transition-[padding] duration-300",
          "[transition-timing-function:var(--ease-glass)]",
          collapsed ? "p-2" : "p-3 sm:p-4",
        )}
        style={{ zIndex: "var(--z-sticky)" as unknown as number }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={cn(
              "glass-subtle specular flex h-9 min-w-0 items-center gap-2 rounded-pill transition-[width,padding] duration-300",
              "[transition-timing-function:var(--ease-glass)]",
              showField ? "flex-1 px-3.5 sm:max-w-sm" : "w-9 justify-center px-0",
            )}
          >
            <button
              type="button"
              onClick={() => {
                setSearchOpen(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              aria-label="Search titles"
              tabIndex={showField ? -1 : 0}
              className={cn("grid shrink-0 place-items-center", showField && "pointer-events-none")}
            >
              <Search className="text-fg-3 size-4" />
            </button>

            <input
              ref={inputRef}
              value={queryDraft}
              onChange={(e) => setQueryDraft(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
              type="search"
              placeholder="Search — typos are fine"
              aria-label="Search titles"
              aria-hidden={!showField}
              tabIndex={showField ? 0 : -1}
              className={cn(
                "placeholder:text-fg-3 min-w-0 flex-1 bg-transparent text-sm outline-none",
                "[&::-webkit-search-cancel-button]:hidden",
                !showField && "w-0 flex-none opacity-0",
              )}
            />
          </div>

          {/* Media chips and sort are the first things to go — they're one tap
              away inside the drawer, and the covers are what you came for. */}
          <div
            className={cn(
              "flex-wrap items-center gap-1.5 overflow-hidden transition-opacity duration-200",
              collapsed ? "hidden" : "hidden sm:flex",
            )}
          >
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
                    "h-8 rounded-pill border px-3 text-xs font-semibold transition-all duration-200",
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
            {!collapsed && (
              <select
                value={view.get("sort") ?? "popularity"}
                onChange={(e) =>
                  update((next) => {
                    if (e.target.value === "popularity") next.delete("sort");
                    else next.set("sort", e.target.value);
                  })
                }
                aria-label="Sort results"
                className="glass-subtle hidden h-8 rounded-pill px-3 text-xs font-semibold outline-none sm:block"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}

            <Button
              size="sm"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className={cn(activeCount > 0 && "border-[var(--accent)]")}
            >
              <SlidersHorizontal className="size-3.5" />
              Filters
              {activeCount > 0 && (
                <span className="ml-0.5 rounded-pill bg-[var(--accent)] px-1.5 text-[10px] text-white tabular-nums">
                  {activeCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* What's on, at a glance, removable without opening anything. */}
        {!collapsed && activeCount > 0 && (
          <ActiveChips
            genres={genres}
            formats={formats}
            statuses={statuses}
            people={people}
            media={media}
            season={view.get("season")}
            pending={pending}
            total={total}
            onClearTri={(key, set, value) => setTriSet(key, set, value, "neutral")}
            onClearMedia={(type) =>
              update((next) => {
                const set = new Set(media);
                set.delete(type);
                if (set.size) next.set("media", [...set].join(","));
                else next.delete("media");
              })
            }
            onClearSeason={() => update((next) => next.delete("season"))}
            onReset={reset}
          />
        )}
      </GlassPanel>

      <FilterDrawer
        open={open}
        onClose={() => setOpen(false)}
        facets={facets}
        total={total}
        pending={pending}
        activeCount={activeCount}
        view={view}
        sets={{ genres, formats, statuses, people }}
        media={media}
        update={update}
        setTriSet={setTriSet}
        onReset={reset}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function ActiveChips({
  genres,
  formats,
  statuses,
  people,
  media,
  season,
  pending,
  total,
  onClearTri,
  onClearMedia,
  onClearSeason,
  onReset,
}: {
  genres: TriStateSet;
  formats: TriStateSet;
  statuses: TriStateSet;
  people: TriStateSet;
  media: MediaType[];
  season: string | null;
  pending: boolean;
  total: number;
  onClearTri: (key: string, set: TriStateSet, value: string) => void;
  onClearMedia: (type: MediaType) => void;
  onClearSeason: () => void;
  onReset: () => void;
}) {
  const pills: { key: string; label: string; exclude?: boolean; clear: () => void }[] =
    [];

  for (const type of media) {
    pills.push({
      key: `media-${type}`,
      label: MEDIA_LABEL[type],
      clear: () => onClearMedia(type),
    });
  }
  for (const [key, set] of [
    ["genres", genres],
    ["formats", formats],
    ["status", statuses],
    ["people", people],
  ] as const) {
    for (const value of set.include) {
      pills.push({
        key: `${key}-${value}`,
        label: key === "formats" ? formatLabel(value) : titleCase(value),
        clear: () => onClearTri(key, set, value),
      });
    }
    for (const value of set.exclude) {
      pills.push({
        key: `${key}-x-${value}`,
        label: key === "formats" ? formatLabel(value) : titleCase(value),
        exclude: true,
        clear: () => onClearTri(key, set, value),
      });
    }
  }
  if (season) {
    pills.push({ key: "season", label: titleCase(season), clear: onClearSeason });
  }

  const shown = pills.slice(0, 8);

  return (
    <div className="border-hairline mt-2.5 flex flex-wrap items-center gap-1.5 border-t pt-2.5">
      {shown.map((pill) => (
        <button
          key={pill.key}
          type="button"
          onClick={pill.clear}
          className={cn(
            "group/pill inline-flex h-7 items-center gap-1.5 rounded-pill border px-2.5 text-[11px] font-semibold",
            "transition-colors duration-150",
            pill.exclude
              ? "border-[color-mix(in_oklch,var(--danger)_45%,transparent)] text-[var(--danger)] line-through"
              : "border-hairline text-fg-2 hover:text-fg",
          )}
        >
          {pill.label}
          <X className="size-3 opacity-50 transition-opacity group-hover/pill:opacity-100" />
        </button>
      ))}

      {pills.length > shown.length && (
        <span className="text-fg-3 text-[11px] tabular-nums">
          +{pills.length - shown.length}
        </span>
      )}

      <span className="text-fg-3 ml-auto text-[11px] tabular-nums">
        {pending ? "Filtering…" : `${total.toLocaleString()} match`}
      </span>

      <button
        type="button"
        onClick={onReset}
        className="text-fg-3 hover:text-fg inline-flex items-center gap-1 text-[11px] font-semibold transition-colors"
      >
        <RotateCcw className="size-3" />
        Clear
      </button>
    </div>
  );
}

/**
 * The filter drawer.
 *
 * It used to be a panel that unfolded inside the sticky bar, which pushed the
 * results off the bottom of the screen and left you filtering something you
 * couldn't see. As a drawer it's a fixed-size surface with its own scroll: on a
 * phone a bottom sheet that stops well short of the top, on a desktop a column
 * down the right-hand side, with the grid still visible and still updating
 * beside it.
 */
function FilterDrawer({
  open,
  onClose,
  facets,
  total,
  pending,
  activeCount,
  view,
  sets,
  media,
  update,
  setTriSet,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  facets: DiscoverFiltersProps["facets"];
  total: number;
  pending: boolean;
  activeCount: number;
  view: URLSearchParams;
  sets: {
    genres: TriStateSet;
    formats: TriStateSet;
    statuses: TriStateSet;
    people: TriStateSet;
  };
  media: MediaType[];
  update: (mutate: (next: URLSearchParams) => void) => void;
  setTriSet: (key: string, set: TriStateSet, value: string, state: TriState) => void;
  onReset: () => void;
}) {
  const hydrated = useHydrated();
  const desktop = useMediaQuery("(min-width: 640px)");

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Only the bottom sheet locks the page — the desktop drawer sits beside the
  // results on purpose, so you can keep scrolling them while you filter.
  React.useEffect(() => {
    if (!open || desktop) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, desktop]);

  if (!hydrated) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 flex items-end justify-center sm:items-stretch sm:justify-end"
          style={{ zIndex: "var(--z-sheet)" as unknown as number }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: "oklch(0 0 0 / 0.42)" }}
          />

          <motion.div
            role="dialog"
            aria-modal={!desktop}
            aria-label="Filters"
            initial={desktop ? { x: "100%" } : { y: "100%" }}
            animate={desktop ? { x: 0 } : { y: 0 }}
            exit={desktop ? { x: "100%" } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.9 }}
            className={cn(
              "glass-heavy specular relative flex w-full flex-col overflow-hidden",
              "max-h-[82dvh] rounded-t-2xl",
              "sm:h-full sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-2xl",
            )}
          >
            <header className="border-hairline flex shrink-0 items-center gap-3 border-b p-4">
              <div className="min-w-0 flex-1">
                <p className="axis-caps text-fg-3">
                  {pending ? "Filtering…" : `${total.toLocaleString()} titles match`}
                </p>
                <h2 className="mt-1 text-base font-bold tracking-tight">
                  Filters
                  {activeCount > 0 && (
                    <span className="text-fg-3 ml-2 text-xs font-semibold tabular-nums">
                      {activeCount} on
                    </span>
                  )}
                </h2>
              </div>

              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-fg-3 hover:text-fg inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="size-3.5" />
                  Reset
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="text-fg-3 hover:text-fg glass-subtle glass-press grid size-8 shrink-0 place-items-center rounded-full"
              >
                <X className="size-4" />
              </button>
            </header>

            {/* The scroll lives HERE, not on the page. */}
            <div className="scroll-glass min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <Section label="Media">
                <div className="flex flex-wrap gap-1.5">
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
                          "h-8 rounded-pill border px-3 text-xs font-semibold transition-all duration-200",
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
              </Section>

              <p className="text-fg-3 text-[11px] leading-relaxed">
                Tap a chip to <span className="text-fg-2 font-semibold">include</span>,
                again to <span className="font-semibold text-[var(--danger)]">exclude</span>,
                again to clear. Right-click clears instantly.
              </p>

              <ChipBank
                label="Genres"
                options={facets.genres}
                set={sets.genres}
                onChange={(v, s) => setTriSet("genres", sets.genres, v, s)}
              />

              <ChipBank
                label="Format"
                options={facets.formats}
                set={sets.formats}
                renderLabel={formatLabel}
                onChange={(v, s) => setTriSet("formats", sets.formats, v, s)}
              />

              <ChipBank
                label="Status"
                options={STATUSES.map((value) => ({ value, count: 0 }))}
                set={sets.statuses}
                showCounts={false}
                renderLabel={(v) => titleCase(v)}
                onChange={(v, s) => setTriSet("status", sets.statuses, v, s)}
              />

              <ChipBank
                label="Studio / Author"
                options={[...facets.studios, ...facets.authors]}
                set={sets.people}
                searchable
                onChange={(v, s) => setTriSet("people", sets.people, v, s)}
              />

              <Section label="Season">
                <div className="flex flex-wrap gap-1.5">
                  {SEASONS.map((season) => {
                    const active = view.get("season") === season;
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
                          "h-8 rounded-pill border px-3 text-xs font-semibold transition-colors",
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
              </Section>

              <Section label="Year">
                <RangeField
                  minValue={view.get("year_min") ?? ""}
                  maxValue={view.get("year_max") ?? ""}
                  min={1940}
                  max={new Date().getFullYear() + 2}
                  label="Year"
                  onChange={(which, value) =>
                    update((next) => {
                      const key = which === "min" ? "year_min" : "year_max";
                      if (value) next.set(key, value);
                      else next.delete(key);
                    })
                  }
                />
              </Section>

              <Section label="Episodes / chapters">
                <RangeField
                  minValue={view.get("count_min") ?? ""}
                  maxValue={view.get("count_max") ?? ""}
                  min={1}
                  max={5000}
                  label="Count"
                  onChange={(which, value) =>
                    update((next) => {
                      const key = which === "min" ? "count_min" : "count_max";
                      if (value) next.set(key, value);
                      else next.delete(key);
                    })
                  }
                />
              </Section>

              <Section label="Minimum rating">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={view.get("score_min") ?? "0"}
                    onChange={(e) =>
                      update((next) => {
                        if (e.target.value === "0") next.delete("score_min");
                        else next.set("score_min", e.target.value);
                      })
                    }
                    aria-label="Minimum rating"
                    className="flex-1 accent-[var(--accent)]"
                  />
                  <span className="numeral w-10 text-right text-xs">
                    {(Number(view.get("score_min") ?? 0) / 10).toFixed(1)}
                  </span>
                </div>
              </Section>
            </div>

            <footer className="border-hairline shrink-0 border-t p-3">
              <button
                type="button"
                onClick={onClose}
                className="h-11 w-full rounded-xl bg-[var(--accent)] text-sm font-bold tracking-tight text-white transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.99]"
              >
                Show {total.toLocaleString()} titles
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="axis-caps text-fg-3 mb-2.5">{label}</p>
      {children}
    </div>
  );
}

function ChipBank({
  label,
  options,
  set,
  onChange,
  renderLabel,
  showCounts = true,
  searchable = false,
}: {
  label: string;
  options: FacetOption[];
  set: TriStateSet;
  onChange: (value: string, state: TriState) => void;
  renderLabel?: (value: string) => string;
  showCounts?: boolean;
  /** Adds a filter field — for banks with more entries than anyone can scan. */
  searchable?: boolean;
}) {
  const [needle, setNeedle] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  if (options.length === 0) return null;

  const selected = [...set.include, ...set.exclude];
  const matching = needle.trim()
    ? options.filter((o) => o.value.toLowerCase().includes(needle.trim().toLowerCase()))
    : options;

  const limit = searchable && !showAll && !needle.trim() ? 12 : matching.length;
  const visible = matching.slice(0, limit);

  // Anything already selected must stay visible even when the list is cut.
  const extras = options.filter(
    (o) => selected.includes(o.value) && !visible.some((v) => v.value === o.value),
  );

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="axis-caps text-fg-3">{label}</p>
        {searchable && (
          <div className="glass-subtle flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-pill px-2.5 sm:max-w-40">
            <Search className="text-fg-3 size-3 shrink-0" />
            <input
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              placeholder="Find…"
              aria-label={`Search ${label}`}
              className="placeholder:text-fg-3 min-w-0 flex-1 bg-transparent text-[11px] outline-none"
            />
          </div>
        )}
      </div>

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

        {visible.length === 0 && (
          <p className="text-fg-3 text-xs">Nothing matched.</p>
        )}

        {searchable && !needle.trim() && matching.length > 12 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-fg-3 hover:text-fg h-8 rounded-pill px-2 text-xs font-semibold transition-colors"
          >
            {showAll ? "Show fewer" : `+${matching.length - 12} more`}
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
        className="glass-subtle placeholder:text-fg-3 h-9 w-full min-w-0 rounded-sm px-2.5 text-xs outline-none"
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
        className="glass-subtle placeholder:text-fg-3 h-9 w-full min-w-0 rounded-sm px-2.5 text-xs outline-none"
      />
    </div>
  );
}
