"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";

import { ProgressStepper, VolumeField } from "@/components/library/progress-stepper";
import { StatusPicker } from "@/components/library/status-picker";
import { DualScore } from "@/components/rating/score";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Segmented } from "@/components/ui/segmented";
import type { LibraryRow } from "@/lib/queries";
import {
  SORT_OPTIONS,
  ratingSortValue,
  type RatingSortKey,
} from "@/lib/rating";
import type { LibraryStatus, MediaType } from "@/lib/types/database";
import {
  LIBRARY_STATUSES,
  cn,
  displayTitle,
  formatLabel,
  isReadable,
  mediaAccent,
  MEDIA_LABEL,
  relativeTime,
  statusLabel,
  totalUnits,
} from "@/lib/utils";

type RatingMap = Record<string, { enjoyment: number | null; craft: number | null }>;

export interface LibraryViewProps {
  entries: Record<MediaType, LibraryRow[]>;
  ratings: RatingMap;
  /** From profiles.preferences — gates the optional "Overall" sort. */
  overallSortEnabled: boolean;
}

type SortKey = "updated" | "title" | "progress" | RatingSortKey;

const BASE_SORTS: { key: SortKey; label: string }[] = [
  { key: "updated", label: "Recently updated" },
  { key: "title", label: "A–Z" },
  { key: "progress", label: "Progress" },
];

export function LibraryView({
  entries,
  ratings,
  overallSortEnabled,
}: LibraryViewProps) {
  const [mediaType, setMediaType] = React.useState<MediaType>("anime");
  const [status, setStatus] = React.useState<LibraryStatus | "all">("all");
  const [sort, setSort] = React.useState<SortKey>("updated");

  const rows = React.useMemo(
    () => entries[mediaType] ?? [],
    [entries, mediaType],
  );

  const statusCounts = React.useMemo(() => {
    const counts: Partial<Record<LibraryStatus, number>> = {};
    for (const row of rows) {
      counts[row.status as LibraryStatus] =
        (counts[row.status as LibraryStatus] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const visible = React.useMemo(() => {
    const filtered =
      status === "all" ? rows : rows.filter((r) => r.status === status);

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "title":
          return displayTitle(a.titles).localeCompare(displayTitle(b.titles));
        case "progress":
          return b.progress - a.progress;
        case "enjoyment":
        case "craft":
        case "overall": {
          const av = ratingSortValue(
            sort,
            ratings[a.title_id]?.enjoyment ?? null,
            ratings[a.title_id]?.craft ?? null,
          );
          const bv = ratingSortValue(
            sort,
            ratings[b.title_id]?.enjoyment ?? null,
            ratings[b.title_id]?.craft ?? null,
          );
          // Unrated titles sink to the bottom rather than sorting as zero.
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return bv - av;
        }
        default:
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
      }
    });
    return sorted;
  }, [rows, status, sort, ratings]);

  const sortOptions = [
    ...BASE_SORTS,
    ...SORT_OPTIONS.filter((o) => !o.requiresOptIn || overallSortEnabled).map(
      (o) => ({ key: o.key as SortKey, label: o.label }),
    ),
  ];

  return (
    <div className="space-y-5">
      <Segmented
        options={(["anime", "manga", "light_novel"] as MediaType[]).map((type) => ({
          value: type,
          label: MEDIA_LABEL[type],
          accent: mediaAccent(type),
          count: entries[type]?.length ?? 0,
        }))}
        value={mediaType}
        onChange={(next) => {
          setMediaType(next);
          setStatus("all");
        }}
        layoutId="library-media-thumb"
      />

      <GlassPanel radius="lg" className="flex flex-wrap items-center gap-3 p-3">
        <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
          <StatusChip
            label="All"
            count={rows.length}
            active={status === "all"}
            onClick={() => setStatus("all")}
          />
          {LIBRARY_STATUSES.map((option) => {
            const count = statusCounts[option] ?? 0;
            if (count === 0) return null;
            return (
              <StatusChip
                key={option}
                label={statusLabel(option, mediaType)}
                count={count}
                active={status === option}
                onClick={() => setStatus(option)}
              />
            );
          })}
        </div>

        <label className="flex shrink-0 items-center gap-2 text-xs">
          <span className="text-fg-3">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="glass-subtle h-8 rounded-pill px-3 text-xs font-medium outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </GlassPanel>

      {visible.length === 0 ? (
        <EmptyState mediaType={mediaType} filtered={status !== "all"} />
      ) : (
        <ul className="space-y-2">
          {visible.map((row, i) => (
            <LibraryRowItem
              key={row.title_id}
              row={row}
              rating={ratings[row.title_id] ?? null}
              index={i}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-xs font-medium transition-colors duration-200",
        active
          ? "border-hairline-strong bg-[var(--glass-3)] text-fg"
          : "border-transparent text-fg-3 hover:text-fg-2",
      )}
    >
      {label}
      <span className="tabular-nums opacity-60">{count}</span>
    </button>
  );
}

function LibraryRowItem({
  row,
  rating,
  index,
}: {
  row: LibraryRow;
  rating: { enjoyment: number | null; craft: number | null } | null;
  index: number;
}) {
  const title = row.titles;
  const total = totalUnits(title);
  const readable = isReadable(title.media_type);
  const pct = total ? Math.min(100, (row.progress / total) * 100) : 0;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.3 }}
    >
      <GlassPanel
        level="subtle"
        radius="md"
        className="relative flex items-center gap-3 p-2.5 sm:gap-4"
      >
        {/*
          Progress fill behind the row. The clipping lives on this wrapper, NOT
          on the panel — `overflow-hidden` on the panel would also clip the
          status dropdown, which opens downward out of the row.
        */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
          aria-hidden
        >
          <div
            className="h-full opacity-[0.13]"
            style={{ width: `${pct}%`, background: mediaAccent(title.media_type) }}
          />
        </div>

        <Link
          href={`/title/${title.id}`}
          className="relative h-16 w-11 shrink-0 overflow-hidden rounded-xs sm:h-20 sm:w-14"
          style={{ background: title.cover_color ?? "var(--bg-base)" }}
        >
          {title.cover_image_large && (
            <Image
              src={title.cover_image_large}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
            />
          )}
        </Link>

        <div className="relative min-w-0 flex-1">
          <Link
            href={`/title/${title.id}`}
            className="hover:text-fg-2 line-clamp-1 text-sm font-medium transition-colors"
          >
            {displayTitle(title)}
          </Link>
          <p className="text-fg-3 mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <span>{formatLabel(title.format)}</span>
            {row.repeat_count > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {row.repeat_count}× {readable ? "reread" : "rewatch"}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{relativeTime(row.updated_at)}</span>
          </p>

          {rating && (rating.enjoyment != null || rating.craft != null) && (
            <DualScore
              enjoyment={rating.enjoyment}
              craft={rating.craft}
              size="xs"
              className="mt-2 max-w-28"
            />
          )}
        </div>

        <div className="relative flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <StatusPicker
              titleId={title.id}
              mediaType={title.media_type}
              status={row.status as LibraryStatus}
              size="sm"
            />
            <ProgressStepper
              titleId={title.id}
              mediaType={title.media_type}
              total={total}
              progress={row.progress}
              size="sm"
            />
          </div>

          {readable && (
            <VolumeField
              titleId={title.id}
              value={row.progress_volumes}
              knownTotal={title.volumes}
            />
          )}
        </div>
      </GlassPanel>
    </motion.li>
  );
}

function EmptyState({
  mediaType,
  filtered,
}: {
  mediaType: MediaType;
  filtered: boolean;
}) {
  return (
    <GlassPanel radius="xl" className="p-10 text-center">
      <p className="text-fg-2 text-sm">
        {filtered
          ? "Nothing in your library with that status."
          : `You haven't added any ${MEDIA_LABEL[mediaType].toLowerCase()} yet.`}
      </p>
      {!filtered && (
        <Link
          href={`/discover?media=${mediaType}`}
          className="text-fg mt-3 inline-block text-sm font-medium underline underline-offset-4"
        >
          Find something to add
        </Link>
      )}
    </GlassPanel>
  );
}
