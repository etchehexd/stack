import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileScatter } from "./profile-scatter";
import { TitleCard } from "@/components/title/title-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  getActivity,
  getFavorites,
  getProfileByUsername,
  getRatingScatter,
  getUserStats,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { QUADRANTS, AXIS_META } from "@/lib/rating";
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
      <GlassPanel radius="xl" className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-lg font-semibold">@{profile.username}</h1>
        <p className="text-fg-3 mt-2 text-sm">This profile is private.</p>
      </GlassPanel>
    );
  }

  const [stats, scatter, favorites, activity] = await Promise.all([
    getUserStats(profile.id),
    getRatingScatter(profile.id),
    getFavorites(profile.id),
    getActivity(profile.id, 15),
  ]);

  const points = scatter.map((row) => ({
    id: row.titles.id,
    enjoyment: Number(row.enjoyment),
    craft: Number(row.craft),
    label: displayTitle(row.titles),
    cover: row.titles.cover_image_large,
    href: `/title/${row.titles.id}`,
    color: mediaAccent(row.titles.media_type),
  }));

  return (
    <div className="space-y-8">
      {/* --- Header ---------------------------------------------------------- */}
      <GlassPanel radius="2xl" className="relative overflow-hidden">
        <div className="h-32 sm:h-44">
          {profile.banner_url ? (
            <Image
              src={profile.banner_url}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div
              className="size-full"
              style={{
                background:
                  "linear-gradient(120deg, var(--color-anime), var(--color-manga) 60%, var(--color-ln))",
                opacity: 0.35,
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-4 p-5 pt-0 sm:flex-row sm:items-end sm:p-6 sm:pt-0">
          <div className="glass-heavy specular relative -mt-10 grid size-20 shrink-0 place-items-center overflow-hidden rounded-full sm:size-24">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <span className="text-2xl font-semibold">
                {(profile.display_name || profile.username).charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {profile.display_name || profile.username}
            </h1>
            <p className="text-fg-3 text-sm">@{profile.username}</p>
            {profile.bio && (
              <p className="text-fg-2 mt-2 max-w-prose text-sm leading-relaxed text-balance-pretty">
                {profile.bio}
              </p>
            )}
          </div>

          {isOwner && (
            <Link
              href="/settings"
              className="text-fg-3 hover:text-fg shrink-0 text-xs font-medium underline underline-offset-4 transition-colors"
            >
              Edit profile
            </Link>
          )}
        </div>
      </GlassPanel>

      {stats && <StatsRow stats={stats} />}

      {/* --- The two-axis chart --------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <GlassPanel radius="xl" className="p-5 sm:p-6">
          <header className="mb-4">
            <h2 className="text-base font-semibold tracking-tight">
              Every rating, on both axes
            </h2>
            <p className="text-fg-3 mt-1 text-xs">
              <span style={{ color: AXIS_META.enjoyment.color }}>Enjoyment</span>{" "}
              across, <span style={{ color: AXIS_META.craft.color }}>Craft</span> up.
              Dot colour is the media type.
            </p>
          </header>

          {points.length === 0 ? (
            <p className="text-fg-3 py-12 text-center text-sm">
              No ratings yet.
              {isOwner && (
                <>
                  {" "}
                  <Link href="/discover" className="text-fg underline underline-offset-4">
                    Go rate something.
                  </Link>
                </>
              )}
            </p>
          ) : (
            <ProfileScatter points={points} />
          )}
        </GlassPanel>

        <div className="space-y-6">
          {stats && <QuadrantBreakdown stats={stats} total={points.length} />}
          {stats && stats.top_genres.length > 0 && (
            <GlassPanel radius="lg" className="p-5">
              <h2 className="mb-3 text-base font-semibold tracking-tight">
                Top genres
              </h2>
              <ul className="space-y-2">
                {stats.top_genres.slice(0, 8).map((genre) => {
                  const max = stats.top_genres[0]?.count || 1;
                  return (
                    <li key={genre.name}>
                      <div className="mb-1 flex items-baseline justify-between text-xs">
                        <span className="font-medium">{genre.name}</span>
                        <span className="text-fg-3 tabular-nums">{genre.count}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-pill bg-[var(--glass-1)]">
                        <div
                          className="h-full rounded-pill bg-[var(--accent)]"
                          style={{ width: `${(genre.count / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </GlassPanel>
          )}

          {stats && stats.top_studios.length > 0 && (
            <GlassPanel radius="lg" className="p-5">
              <h2 className="mb-3 text-base font-semibold tracking-tight">
                Most-watched studios &amp; authors
              </h2>
              <ul className="space-y-1.5 text-sm">
                {stats.top_studios.slice(0, 6).map((studio) => (
                  <li key={studio.name} className="flex justify-between gap-3">
                    <Link
                      href={`/discover?people=${encodeURIComponent(studio.name)}`}
                      className="hover:text-fg-2 truncate transition-colors"
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
      </div>

      {/* --- Favorites ------------------------------------------------------ */}
      {favorites.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold tracking-tight">Favorites</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {favorites.map((title) => (
              <TitleCard key={title.id} title={title} />
            ))}
          </div>
        </section>
      )}

      {/* --- Activity ------------------------------------------------------- */}
      {activity.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold tracking-tight">
            Recent activity
          </h2>
          <GlassPanel radius="lg" className="divide-hairline divide-y">
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

function StatsRow({ stats }: { stats: UserStats }) {
  const cells = [
    { label: "Titles tracked", value: compactNumber(stats.total_entries) },
    { label: "Completed", value: compactNumber(stats.completed) },
    { label: "Episodes", value: compactNumber(stats.episodes_watched) },
    { label: "Time watched", value: formatMinutes(stats.minutes_watched) },
    { label: "Chapters", value: compactNumber(stats.chapters_read) },
    { label: "Rated", value: compactNumber(stats.rated_count) },
    {
      label: "Avg enjoyment",
      value: stats.avg_enjoyment != null ? Number(stats.avg_enjoyment).toFixed(1) : "—",
      color: AXIS_META.enjoyment.color,
    },
    {
      label: "Avg craft",
      value: stats.avg_craft != null ? Number(stats.avg_craft).toFixed(1) : "—",
      color: AXIS_META.craft.color,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {cells.map((cell) => (
        <GlassPanel key={cell.label} level="subtle" radius="md" className="p-3.5">
          <p
            className="text-lg font-semibold tabular-nums"
            style={cell.color ? { color: cell.color } : undefined}
          >
            {cell.value}
          </p>
          <p className="text-fg-3 mt-0.5 text-[11px]">{cell.label}</p>
        </GlassPanel>
      ))}
    </div>
  );
}

function QuadrantBreakdown({ stats, total }: { stats: UserStats; total: number }) {
  const rows = [
    { meta: QUADRANTS.favorites, count: stats.quadrants.favorites },
    { meta: QUADRANTS.guilty, count: stats.quadrants.guilty },
    { meta: QUADRANTS.respected, count: stats.quadrants.respected },
    { meta: QUADRANTS.notforyou, count: stats.quadrants.notforyou },
  ];

  return (
    <GlassPanel radius="lg" className="p-5">
      <h2 className="mb-3 text-base font-semibold tracking-tight">Quadrants</h2>
      <ul className="space-y-3">
        {rows.map(({ meta, count }) => (
          <li key={meta.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="text-fg-3 text-xs tabular-nums">{count}</span>
            </div>
            <p className="text-fg-3 mb-1.5 text-[11px]">{meta.description}</p>
            <div className="h-1 overflow-hidden rounded-pill bg-[var(--glass-1)]">
              <div
                className="h-full rounded-pill"
                style={{
                  width: `${total ? (count / total) * 100 : 0}%`,
                  background: meta.color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </GlassPanel>
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
  const payload = item.payload as { enjoyment?: number; craft?: number; progress?: number };

  return (
    <div className="flex items-center gap-3 p-3">
      {item.titles?.cover_image_large && (
        <Link
          href={`/title/${item.titles.id}`}
          className="relative h-12 w-8 shrink-0 overflow-hidden rounded-xs"
        >
          <Image
            src={item.titles.cover_image_large}
            alt=""
            fill
            sizes="32px"
            className="object-cover"
          />
        </Link>
      )}

      <p className="text-fg-2 min-w-0 flex-1 text-sm">
        {ACTIVITY_VERB[item.kind] ?? item.kind}{" "}
        {item.titles && (
          <Link
            href={`/title/${item.titles.id}`}
            className="text-fg font-medium hover:underline"
          >
            {displayTitle(item.titles)}
          </Link>
        )}
        {item.kind === "rated" && payload.enjoyment != null && (
          <span className="text-fg-3">
            {" "}
            — E {payload.enjoyment}
            {payload.craft != null && ` · C ${payload.craft}`}
          </span>
        )}
        {item.kind === "progress" && payload.progress != null && (
          <span className="text-fg-3"> — #{payload.progress}</span>
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
