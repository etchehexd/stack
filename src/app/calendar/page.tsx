import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Bookmark } from "lucide-react";

import { CalendarFilter } from "./calendar-filter";
import { GlassPanel } from "@/components/ui/glass-panel";
import { getAiringWeek, getTrackedTitleIds, type AiringRow } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { cn, countdown, displayTitle, mediaAccent } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Everything airing this week, with the shows you track highlighted.",
};

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const sp = await props.searchParams;
  const onlyTracked = sp.tracked === "1";

  // The window (and the single reference timestamp) come from the data layer,
  // so this component stays a pure function of its inputs.
  const [{ now, from, rows: airing }, tracked, user] = await Promise.all([
    getAiringWeek(),
    getTrackedTitleIds(),
    getCurrentUser(),
  ]);

  const filtered = onlyTracked
    ? airing.filter((row) => tracked.has(row.titles.id))
    : airing;

  // Bucket into days.
  const days = new Map<string, AiringRow[]>();
  for (let i = 0; i < 7; i++) {
    const day = new Date(from);
    day.setDate(day.getDate() + i);
    days.set(day.toDateString(), []);
  }
  for (const row of filtered) {
    const key = new Date(row.airing_at).toDateString();
    days.get(key)?.push(row);
  }

  const trackedCount = airing.filter((r) => tracked.has(r.titles.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-fg-3 mt-1 text-sm">
            The next seven days of airing episodes.
            {user && trackedCount > 0 && ` ${trackedCount} from your library.`}
          </p>
        </div>
        {user && <CalendarFilter onlyTracked={onlyTracked} count={trackedCount} />}
      </div>

      {airing.length === 0 ? (
        <GlassPanel radius="xl" className="p-10 text-center">
          <p className="text-fg-2 text-sm">No airing data yet.</p>
          <pre className="glass-subtle mx-auto mt-4 inline-block rounded-md px-4 py-2 font-mono text-xs">
            npm run sync:airing
          </pre>
        </GlassPanel>
      ) : (
        <div className="space-y-6">
          {[...days.entries()].map(([dayKey, rows]) => (
            <DaySection
              key={dayKey}
              date={new Date(dayKey)}
              rows={rows}
              tracked={tracked}
              now={now}
              isToday={dayKey === from.toDateString()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DaySection({
  date,
  rows,
  tracked,
  now,
  isToday,
}: {
  date: Date;
  rows: AiringRow[];
  tracked: Set<string>;
  now: number;
  isToday: boolean;
}) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const dayLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <section>
      <header className="mb-3 flex items-baseline gap-2.5">
        <h2
          className={cn(
            "text-base font-semibold tracking-tight",
            isToday && "text-[var(--accent)]",
          )}
        >
          {isToday ? "Today" : weekday}
        </h2>
        <span className="text-fg-3 text-xs">{dayLabel}</span>
        {rows.length > 0 && (
          <span className="text-fg-3 text-xs tabular-nums">
            · {rows.length} {rows.length === 1 ? "episode" : "episodes"}
          </span>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="text-fg-3 border-hairline rounded-md border border-dashed px-4 py-3 text-xs">
          Nothing airing.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <AiringItem
              key={row.id}
              row={row}
              now={now}
              isTracked={tracked.has(row.titles.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AiringItem({
  row,
  now,
  isTracked,
}: {
  row: AiringRow;
  now: number;
  isTracked: boolean;
}) {
  const title = row.titles;
  const airsAt = new Date(row.airing_at);
  const time = airsAt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const accent = mediaAccent(title.media_type);
  const aired = airsAt.getTime() < now;

  return (
    <li>
      <Link href={`/title/${title.id}`} className="block">
        <GlassPanel
          level={isTracked ? "default" : "subtle"}
          radius="md"
          className={cn(
            "glass-press flex items-center gap-3 p-2.5 transition-opacity",
            aired && "opacity-55",
          )}
          style={
            isTracked
              ? { borderColor: `color-mix(in oklch, ${accent} 45%, transparent)` }
              : undefined
          }
        >
          <div
            className="relative h-16 w-11 shrink-0 overflow-hidden rounded-xs"
            style={{ background: title.cover_color ?? "var(--bg-base)" }}
          >
            {title.cover_image_large && (
              <Image
                src={title.cover_image_large}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isTracked && (
                <Bookmark
                  className="size-3 shrink-0 fill-current"
                  style={{ color: accent }}
                  aria-label="In your library"
                />
              )}
              <p className="line-clamp-1 text-sm font-medium">{displayTitle(title)}</p>
            </div>
            <p className="text-fg-3 mt-0.5 text-xs">
              Episode {row.episode} · {time}
            </p>
          </div>

          <span className="text-fg-3 shrink-0 text-xs tabular-nums">
            {aired ? "aired" : countdown(row.airing_at, now)}
          </span>
        </GlassPanel>
      </Link>
    </li>
  );
}
