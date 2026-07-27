import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TitleCard } from "@/components/title/title-card";
import { ScoreChip } from "@/components/rating/score-chip";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  getActivity,
  getFavorites,
  getProfileByUsername,
  getRatedTitles,
  getUserStats,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { BUCKETS, BUCKET_ORDER, formatScore, scoreColor } from "@/lib/rating";
import type { UserStats } from "@/lib/types/database";
import {
  compactNumber,
  displayTitle,
  formatMinutes,
  mediaAccent,
  relativeTime,
} from "@/lib/utils";

export async function generateMetadata(
  props: PageProps<"/u/[username]">,
): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username}` };
}

export default async function ProfilePage(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;

  const [profile, viewer] = await Promise.all([
    getProfileByUsername(username),
    getCurrentUser(),
  ]);
  if (!profile) notFound();

  const isOwner = viewer?.id === profile.id;

  if (profile.is_private && !isOwner) {
    return (
      <GlassPanel radius="2xl" className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-lg font-bold tracking-tight">@{profile.username}</h1>
        <p className="text-fg-3 mt-2 text-sm">This profile is private.</p>
      </GlassPanel>
    );
  }

  const [stats, rated, favorites, activity] = await Promise.all([
    getUserStats(profile.id),
    getRatedTitles(profile.id, 24),
    getFavorites(profile.id),
    getActivity(profile.id, 12),
  ]);

  const avg = stats?.avg_score != null ? Number(stats.avg_score) : null;

  return (
    <div className="pb-4">
      {/* ===================================================================
          Header. The avatar overlaps the banner and the identity sits beside
          it; the average score is the one number big enough to read from
          across the room, because on a rating site that IS the profile.
          =================================================================== */}
      <section className="relative -mx-4 -mt-[4.5rem] sm:-mx-6 lg:-mx-10">
        <div className="relative h-52 overflow-hidden sm:h-64">
          {profile.banner_url ? (
            <Image
              src={profile.banner_url}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className="size-full bg-[var(--glass-1)]" />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--bg-deep) 4%, color-mix(in oklch, var(--bg-deep) 62%, transparent) 62%, transparent 100%)",
            }}
            aria-hidden
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end gap-4 sm:gap-6">
            <div
              className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl sm:size-28"
              style={{
                background: "var(--glass-3)",
                border: "1px solid oklch(1 0 0 / 0.16)",
                boxShadow: "var(--shadow-lift)",
              }}
            >
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <span className="numeral text-3xl">
                  {(profile.display_name || profile.username)
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <h1 className="page-title truncate">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-fg-3 mt-1 text-sm">@{profile.username}</p>
            </div>

            {avg != null && (
              <div className="pb-1 text-right">
                <p className="axis-caps text-fg-3 mb-1">Average score</p>
                <p
                  className="numeral text-4xl leading-none sm:text-6xl"
                  style={{ color: scoreColor(avg) }}
                >
                  {formatScore(avg)}
                </p>
              </div>
            )}

            {isOwner && (
              <Link
                href="/settings"
                className="text-fg-3 hover:text-fg shrink-0 pb-2 text-xs font-semibold transition-colors"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
      </section>

      {profile.bio && (
        <p className="text-fg-2 mt-5 max-w-prose text-sm leading-relaxed">
          {profile.bio}
        </p>
      )}

      {stats && (
        <>
          <BucketBar stats={stats} />
          <StatsRow stats={stats} />
        </>
      )}

      {/* ===================================================================
          The ranked list. This is the profile's centrepiece: not a chart, just
          the titles in the order this person actually put them.
          =================================================================== */}
      {rated.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold tracking-tight sm:text-xl">
            Ranked
          </h2>
          <ol className="grid gap-2 sm:grid-cols-2">
            {rated.map((entry, i) => (
              <li key={entry.title.id}>
                <Link
                  href={`/title/${entry.title.id}`}
                  className="lift art-edge flex items-center gap-3 rounded-xl p-2 pr-4"
                  style={
                    {
                      "--art": entry.title.cover_color ?? undefined,
                      background: "var(--glass-1)",
                    } as React.CSSProperties
                  }
                >
                  <span className="numeral text-fg-3 w-7 shrink-0 text-right text-sm">
                    {i + 1}
                  </span>
                  <span
                    className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg"
                    style={{
                      background: entry.title.cover_color ?? "var(--glass-2)",
                    }}
                  >
                    {entry.title.cover_image_large && (
                      <Image
                        src={entry.title.cover_image_large}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-[13px] font-semibold tracking-tight">
                      {displayTitle(entry.title)}
                    </span>
                    <span className="text-fg-3 mt-0.5 flex items-center gap-1.5 text-[11px]">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: mediaAccent(entry.title.media_type) }}
                      />
                      {entry.title.season_year ?? "—"}
                    </span>
                  </span>
                  <span
                    className="numeral shrink-0 text-lg"
                    style={{ color: scoreColor(entry.score) }}
                  >
                    {formatScore(entry.score)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {stats && (stats.top_genres.length > 0 || stats.top_studios.length > 0) && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {stats.top_genres.length > 0 && (
            <GlassPanel radius="2xl" className="p-5 sm:p-6">
              <h2 className="panel-title mb-4">Top genres</h2>
              <ul className="space-y-3">
                {stats.top_genres.slice(0, 8).map((genre) => {
                  const max = stats.top_genres[0]?.count || 1;
                  return (
                    <li key={genre.name}>
                      <div className="mb-1.5 flex items-baseline justify-between text-xs">
                        <Link
                          href={`/discover?genres=${encodeURIComponent(genre.name)}`}
                          className="hover:text-fg-2 font-semibold transition-colors"
                        >
                          {genre.name}
                        </Link>
                        <span className="text-fg-3 tabular-nums">{genre.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-1)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${(genre.count / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </GlassPanel>
          )}

          {stats.top_studios.length > 0 && (
            <GlassPanel radius="2xl" className="p-5 sm:p-6">
              <h2 className="panel-title mb-4">Studios &amp; authors</h2>
              <ul className="divide-hairline divide-y text-sm">
                {stats.top_studios.slice(0, 8).map((studio) => (
                  <li key={studio.name} className="flex justify-between gap-3 py-2">
                    <Link
                      href={`/discover?people=${encodeURIComponent(studio.name)}`}
                      className="hover:text-fg-2 truncate font-medium transition-colors"
                    >
                      {studio.name}
                    </Link>
                    <span className="text-fg-3 shrink-0 tabular-nums">
                      {studio.count}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          )}
        </div>
      )}

      {favorites.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold tracking-tight sm:text-xl">
            Favorites
          </h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-8">
            {favorites.map((title) => (
              <TitleCard key={title.id} title={title} />
            ))}
          </div>
        </section>
      )}

      {activity.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold tracking-tight sm:text-xl">
            Recent activity
          </h2>
          <GlassPanel radius="2xl" className="divide-hairline divide-y">
            {activity.map((item) => (
              <ActivityLine key={item.id} item={item} />
            ))}
          </GlassPanel>
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * How the library splits across the three buckets, as one stacked bar.
 *
 * A person whose bar is 80% green rates generously; one who's mostly amber is
 * hard to please. That's the single most interesting thing about someone's
 * taste and it takes one line to show.
 */
function BucketBar({ stats }: { stats: UserStats }) {
  const total =
    stats.buckets.loved + stats.buckets.fine + stats.buckets.bad;
  if (total === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex h-3 gap-1 overflow-hidden">
        {BUCKET_ORDER.map((key) => {
          const n = stats.buckets[key];
          if (n === 0) return null;
          return (
            <span
              key={key}
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(n / total) * 100}%`,
                background: BUCKETS[key].color,
              }}
              title={`${BUCKETS[key].label}: ${n}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {BUCKET_ORDER.map((key) => (
          <span key={key} className="flex items-baseline gap-2">
            <span
              className="size-2 shrink-0 translate-y-[-1px] rounded-full"
              style={{ background: BUCKETS[key].color }}
            />
            <span className="numeral text-sm">{stats.buckets[key]}</span>
            <span className="axis-caps text-fg-3">{BUCKETS[key].label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function StatsRow({ stats }: { stats: UserStats }) {
  const cells = [
    { label: "Tracked", value: compactNumber(stats.total_entries) },
    { label: "Completed", value: compactNumber(stats.completed) },
    { label: "Rated", value: compactNumber(stats.rated_count) },
    { label: "Episodes", value: compactNumber(stats.episodes_watched) },
    { label: "Chapters", value: compactNumber(stats.chapters_read) },
    { label: "Watch time", value: formatMinutes(stats.minutes_watched) },
  ];

  return (
    <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {cells.map((cell) => (
        <GlassPanel key={cell.label} level="subtle" radius="xl" className="p-3.5">
          <p className="numeral text-xl leading-none sm:text-2xl">{cell.value}</p>
          <p className="axis-caps text-fg-3 mt-2 truncate">{cell.label}</p>
        </GlassPanel>
      ))}
    </div>
  );
}

const ACTIVITY_VERB: Record<string, string> = {
  rated: "rated",
  status_changed: "updated",
  progress: "made progress on",
  completed: "completed",
  started: "started",
  favorited: "favorited",
  review_posted: "reviewed",
  list_created: "created a list",
  followed: "followed someone",
};

function ActivityLine({
  item,
}: {
  item: Awaited<ReturnType<typeof getActivity>>[number];
}) {
  const payload = item.payload as { score?: number; progress?: number };

  return (
    <div className="flex items-center gap-3 p-3">
      {item.titles?.cover_image_large && (
        <Link
          href={`/title/${item.titles.id}`}
          className="relative h-12 w-9 shrink-0 overflow-hidden rounded-lg"
        >
          <Image
            src={item.titles.cover_image_large}
            alt=""
            fill
            sizes="36px"
            className="object-cover"
          />
        </Link>
      )}

      <p className="text-fg-2 min-w-0 flex-1 text-sm">
        {ACTIVITY_VERB[item.kind] ?? item.kind}{" "}
        {item.titles && (
          <Link
            href={`/title/${item.titles.id}`}
            className="text-fg font-semibold hover:underline"
          >
            {displayTitle(item.titles)}
          </Link>
        )}
      </p>

      {item.kind === "rated" && payload.score != null && (
        <ScoreChip score={payload.score} mine size="sm" className="shrink-0" />
      )}

      <time
        dateTime={item.created_at}
        className="text-fg-3 shrink-0 text-xs whitespace-nowrap"
      >
        {relativeTime(item.created_at)}
      </time>
    </div>
  );
}
