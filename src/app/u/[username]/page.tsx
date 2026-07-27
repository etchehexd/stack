import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TitleCard } from "@/components/title/title-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  getActivity,
  getFavorites,
  getProfileByUsername,
  getUserStats,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { AXIS_META, formatTen } from "@/lib/rating";
import type { UserStats } from "@/lib/types/database";
import {
  compactNumber,
  displayTitle,
  formatMinutes,
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
      <GlassPanel radius="xl" className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-lg font-bold">@{profile.username}</h1>
        <p className="text-fg-3 mt-2 text-sm">This profile is private.</p>
      </GlassPanel>
    );
  }

  const [stats, favorites, activity] = await Promise.all([
    getUserStats(profile.id),
    getFavorites(profile.id),
    getActivity(profile.id, 15),
  ]);

  return (
    <div className="space-y-10">
      {/* ===== Header ======================================================= */}
      <section className="relative -mx-4 -mt-20 sm:-mx-6 lg:-mx-10">
        <div className="relative h-56 overflow-hidden sm:h-72">
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
                "linear-gradient(to top, var(--bg-deep) 6%, color-mix(in oklch, var(--bg-deep) 60%, transparent) 60%, transparent 100%)",
            }}
            aria-hidden
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end gap-5">
            <div
              className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl sm:size-28"
              style={{
                background: "var(--glass-3)",
                border: "1px solid oklch(1 0 0 / 0.14)",
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
              <h1 className="page-title">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-fg-3 mt-1 text-sm">@{profile.username}</p>
            </div>

            {isOwner && (
              <Link
                href="/settings"
                className="text-fg-3 hover:text-fg shrink-0 pb-2 text-xs font-semibold transition-colors"
              >
                Edit profile
              </Link>
            )}
          </div>
        </div>
      </section>

      {profile.bio && (
        <p className="text-fg-2 max-w-prose text-sm leading-relaxed">
          {profile.bio}
        </p>
      )}

      {/* ===== Averages ===================================================== */}
      {stats && (stats.avg_enjoyment != null || stats.avg_craft != null) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <AverageCard
            label="Average enjoyment"
            value={stats.avg_enjoyment}
            color={AXIS_META.enjoyment.color}
          />
          <AverageCard
            label="Average craft"
            value={stats.avg_craft}
            color={AXIS_META.craft.color}
          />
        </div>
      )}

      {stats && <StatsRow stats={stats} />}

      {/* ===== Taste ======================================================== */}
      {stats && (stats.top_genres.length > 0 || stats.top_studios.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {stats.top_genres.length > 0 && (
            <GlassPanel radius="xl" className="p-5 sm:p-6">
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
                        <span className="text-fg-3 tabular-nums">
                          {genre.count}
                        </span>
                      </div>
                      <div className="rounded-pill h-1.5 overflow-hidden bg-[var(--glass-1)]">
                        <div
                          className="rounded-pill h-full bg-[var(--accent)]"
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
            <GlassPanel radius="xl" className="p-5 sm:p-6">
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

      {/* ===== Favorites ==================================================== */}
      {favorites.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold tracking-tight sm:text-xl">
            Favorites
          </h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {favorites.map((title) => (
              <TitleCard key={title.id} title={title} />
            ))}
          </div>
        </section>
      )}

      {/* ===== Activity ===================================================== */}
      {activity.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold tracking-tight sm:text-xl">
            Recent activity
          </h2>
          <GlassPanel radius="xl" className="divide-hairline divide-y">
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

function AverageCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string | null;
  color: string;
}) {
  const num = value == null ? null : Number(value);

  return (
    <GlassPanel radius="xl" className="flex items-center gap-5 p-5 sm:p-6">
      <span className="numeral text-5xl leading-none sm:text-6xl" style={{ color }}>
        {formatTen(num)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="axis-caps" style={{ color }}>
          {label}
        </p>
        <div className="rounded-pill mt-2.5 h-1.5 overflow-hidden bg-[var(--glass-1)]">
          <div
            className="rounded-pill h-full"
            style={{
              width: `${num == null ? 0 : (num / 5) * 100}%`,
              background: color,
            }}
          />
        </div>
      </div>
    </GlassPanel>
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((cell) => (
        <GlassPanel key={cell.label} level="subtle" radius="lg" className="p-4">
          <p className="numeral text-2xl leading-none">{cell.value}</p>
          <p className="axis-caps text-fg-3 mt-2">{cell.label}</p>
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
  const payload = item.payload as {
    enjoyment?: number;
    craft?: number;
    progress?: number;
  };

  return (
    <div className="flex items-center gap-3 p-3">
      {item.titles?.cover_image_large && (
        <Link
          href={`/title/${item.titles.id}`}
          className="relative h-14 w-10 shrink-0 overflow-hidden rounded-sm"
        >
          <Image
            src={item.titles.cover_image_large}
            alt=""
            fill
            sizes="40px"
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
        {item.kind === "rated" && payload.enjoyment != null && (
          <span className="numeral ml-1.5 text-xs">
            <span style={{ color: AXIS_META.enjoyment.color }}>
              {formatTen(payload.enjoyment)}
            </span>
            {payload.craft != null && (
              <>
                <span className="text-fg-3 mx-1 opacity-40">/</span>
                <span style={{ color: AXIS_META.craft.color }}>
                  {formatTen(payload.craft)}
                </span>
              </>
            )}
          </span>
        )}
        {item.kind === "progress" && payload.progress != null && (
          <span className="text-fg-3 tabular-nums"> · #{payload.progress}</span>
        )}
      </p>

      <time
        dateTime={item.created_at}
        className="text-fg-3 shrink-0 text-xs whitespace-nowrap"
      >
        {relativeTime(item.created_at)}
      </time>
    </div>
  );
}
