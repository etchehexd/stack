import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  CheckCheck,
  Clock,
  Film,
  Layers,
  Star,
  Trophy,
} from "lucide-react";

import { TitleCard } from "@/components/title/title-card";
import { ScoreChip } from "@/components/rating/score-chip";
import { RatingDistribution } from "@/components/rating/rating-distribution";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getActivity,
  getFavorites,
  getProfileByUsername,
  getRatedTitles,
  getUserScoreSpread,
  getUserStats,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { BUCKETS, BUCKET_ORDER } from "@/lib/rating";
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

  const [stats, rated, favorites, activity, spread] = await Promise.all([
    getUserStats(profile.id),
    getRatedTitles(profile.id, 30),
    getFavorites(profile.id),
    getActivity(profile.id, 12),
    getUserScoreSpread(profile.id),
  ]);

  const avg = stats?.avg_score != null ? Number(stats.avg_score) : null;
  const name = profile.display_name || profile.username;

  /*
    The whole page is tinted by this person's own number one. A profile is the
    most personal surface in the app and it was the only one taking no colour
    from its contents — so everyone's looked identical.
  */
  const art = rated[0]?.title.cover_color ?? "var(--accent)";
  const podium = rated.slice(0, 3);
  const rest = rated.slice(3);

  return (
    <div className="pb-4" style={{ "--art": art } as React.CSSProperties}>
      {/* ===================================================================
          Identity.
          =================================================================== */}
      <section className="relative -mx-4 -mt-[4.5rem] sm:-mx-6 lg:-mx-10">
        <div className="relative h-56 overflow-hidden sm:h-64">
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
                background: `radial-gradient(70% 120% at 20% 0%, color-mix(in oklch, ${art} 45%, transparent) 0%, transparent 70%), var(--bg-base)`,
              }}
            />
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
          <div className="flex items-end gap-4 sm:gap-6">
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
                <span className="numeral text-3xl">{name.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              {stats && <TasteBadge stats={stats} />}
              <h1 className="page-title mt-1.5 truncate">{name}</h1>
              <p className="text-fg-3 mt-1 text-sm">@{profile.username}</p>
            </div>

            {isOwner && (
              <Link
                href="/settings"
                className={buttonVariants({
                  size: "sm",
                  className: "mb-1 shrink-0",
                })}
              >
                Edit profile
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

      {/* ===================================================================
          The number, the shape behind it, and the split. On a rating site
          this IS the profile — so it gets the panel at the top rather than a
          stat tile in a row of six.
          =================================================================== */}
      {stats && (
        <GlassPanel radius="2xl" className="relative mt-6 overflow-hidden p-5 sm:p-6">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(90% 130% at 0% 0%, color-mix(in oklch, ${art} 20%, transparent) 0%, transparent 62%)`,
            }}
            aria-hidden
          />

          <div className="relative grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-8">
            <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-5">
              <div>
                <p className="axis-caps text-fg-3 mb-2">Average</p>
                <div className="flex items-center gap-3">
                  {avg != null ? (
                    <ScoreChip score={avg} mine size="lg" />
                  ) : (
                    <span className="numeral text-fg-3 text-4xl">—</span>
                  )}
                  <p className="text-fg-3 text-xs">
                    across
                    <br />
                    {compactNumber(stats.rated_count)} rated
                  </p>
                </div>
              </div>

              {stats.rated_count > 0 && <BucketSplit stats={stats} />}
            </div>

            <div className="border-hairline sm:border-l sm:pl-8">
              {spread.count > 0 ? (
                <RatingDistribution
                  bins={spread.bins}
                  count={spread.count}
                  average={spread.average}
                />
              ) : (
                <div className="flex h-full flex-col justify-center">
                  <p className="text-fg-2 text-sm font-semibold">Nothing rated yet.</p>
                  <p className="text-fg-3 mt-1.5 text-xs leading-relaxed">
                    {isOwner
                      ? "Rate ten things and this fills in with the shape of your taste."
                      : "This profile hasn't rated anything yet."}
                  </p>
                  {isOwner && (
                    <Link
                      href="/discover"
                      className={buttonVariants({
                        size: "sm",
                        className: "mt-4 self-start",
                      })}
                    >
                      Find something to rate
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </GlassPanel>
      )}

      {stats && <StatsRow stats={stats} />}

      {/* ===================================================================
          The ranked list, with the top three given the room they earned.
          =================================================================== */}
      {podium.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
            <Trophy className="size-4 text-[var(--color-enjoyment)]" />
            Their top {podium.length === 3 ? "three" : podium.length}
          </h2>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {podium.map((entry, i) => (
              <PodiumCard key={entry.title.id} entry={entry} place={i + 1} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-8">
          <h2 className="text-fg-2 mb-3 text-sm font-bold tracking-tight">
            And then
          </h2>
          <ol className="grid gap-2 sm:grid-cols-2">
            {rest.map((entry, i) => (
              <li key={entry.title.id}>
                <Link
                  href={`/title/${entry.title.id}`}
                  className="lift art-edge flex items-center gap-3 rounded-xl p-2 pr-3"
                  style={
                    {
                      "--art": entry.title.cover_color ?? undefined,
                      background: "var(--glass-1)",
                    } as React.CSSProperties
                  }
                >
                  <span className="numeral text-fg-3 w-7 shrink-0 text-right text-sm">
                    {i + 4}
                  </span>
                  <span
                    className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg"
                    style={{ background: entry.title.cover_color ?? "var(--glass-2)" }}
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
                  <ScoreChip score={entry.score} mine size="sm" />
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
              <h2 className="panel-title mb-4">What they watch</h2>
              <ul className="space-y-3">
                {stats.top_genres.slice(0, 8).map((genre, i) => {
                  const max = stats.top_genres[0]?.count || 1;
                  const tint = GENRE_TINTS[i % GENRE_TINTS.length];
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
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--glass-1)]">
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{
                            width: `${(genre.count / max) * 100}%`,
                            background: tint,
                            boxShadow: `0 0 12px -4px ${tint}`,
                          }}
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
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
            <Star className="size-4 text-[var(--color-enjoyment)]" />
            Pinned favourites
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

const GENRE_TINTS = [
  "var(--color-anime)",
  "var(--color-manga)",
  "var(--color-ln)",
  "var(--color-enjoyment)",
  "var(--color-craft)",
];

/**
 * Who this person is as a rater, in one word.
 *
 * Everyone's average sits somewhere between 6 and 8, so the average alone
 * distinguishes nobody. The split across the three buckets does: a profile
 * that's 70% "loved" is a different animal from one that's a third "didn't
 * like it", and that's the fun part of looking at someone else's page.
 */
function TasteBadge({ stats }: { stats: UserStats }) {
  const total = stats.buckets.loved + stats.buckets.fine + stats.buckets.bad;
  if (total < 5) {
    return (
      <p className="axis-caps text-fg-3">
        {total === 0 ? "New here" : `${total} rated`}
      </p>
    );
  }

  const loved = stats.buckets.loved / total;
  const bad = stats.buckets.bad / total;

  const [label, tint] =
    loved > 0.6
      ? ["Easy to please", BUCKETS.loved.color]
      : bad > 0.3
        ? ["Tough crowd", BUCKETS.bad.color]
        : loved > 0.4
          ? ["Enthusiast", BUCKETS.loved.color]
          : ["Balanced", BUCKETS.fine.color];

  return (
    <span
      className="axis-caps inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1"
      style={{
        color: tint,
        background: `color-mix(in oklch, ${tint} 16%, transparent)`,
        border: `1px solid color-mix(in oklch, ${tint} 30%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: tint }} />
      {label}
    </span>
  );
}

/** How the library splits across the three buckets, as one stacked bar. */
function BucketSplit({ stats }: { stats: UserStats }) {
  const total = stats.buckets.loved + stats.buckets.fine + stats.buckets.bad;
  if (total === 0) return null;

  return (
    <div className="min-w-0 flex-1 sm:w-full sm:flex-none">
      <div className="flex h-2.5 gap-1 overflow-hidden">
        {BUCKET_ORDER.map((key) => {
          const n = stats.buckets[key];
          if (n === 0) return null;
          return (
            <span
              key={key}
              className="h-full rounded-full"
              style={{
                width: `${(n / total) * 100}%`,
                background: BUCKETS[key].color,
                boxShadow: `0 0 10px -2px ${BUCKETS[key].color}`,
              }}
              title={`${BUCKETS[key].label}: ${n}`}
            />
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {BUCKET_ORDER.map((key) => (
          <span key={key} className="flex items-baseline gap-1.5">
            <span
              className="size-1.5 shrink-0 translate-y-[-1px] rounded-full"
              style={{ background: BUCKETS[key].color }}
            />
            <span className="numeral text-xs">{stats.buckets[key]}</span>
            <span className="axis-caps text-fg-3">{BUCKETS[key].label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function PodiumCard({
  entry,
  place,
}: {
  entry: { score: number; title: Awaited<ReturnType<typeof getRatedTitles>>[number]["title"] };
  place: number;
}) {
  const medal =
    place === 1
      ? "var(--color-enjoyment)"
      : place === 2
        ? "oklch(0.82 0.02 265)"
        : "oklch(0.68 0.09 55)";

  return (
    <Link
      href={`/title/${entry.title.id}`}
      className="art-glow lift group/pod block"
      style={
        { "--art": entry.title.cover_color ?? undefined } as React.CSSProperties
      }
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-xl"
        style={{
          background: entry.title.cover_color ?? "var(--glass-2)",
          border: `1px solid color-mix(in oklch, ${medal} 45%, transparent)`,
          boxShadow: `0 10px 30px -18px ${medal}`,
        }}
      >
        {entry.title.cover_image_large && (
          <Image
            src={entry.title.cover_image_large}
            alt=""
            fill
            sizes="(max-width: 640px) 30vw, 220px"
            className="object-cover transition-transform duration-500 group-hover/pod:scale-[1.06]"
          />
        )}

        <div
          className="absolute inset-x-0 bottom-0 h-2/5"
          style={{
            background:
              "linear-gradient(to top, oklch(0 0 0 / 0.85), transparent 100%)",
          }}
          aria-hidden
        />

        <span
          className="numeral absolute top-2 left-2 grid size-7 place-items-center rounded-full text-[13px]"
          style={{
            background: medal,
            color: "oklch(0.16 0.02 265)",
            boxShadow: `0 4px 14px -4px ${medal}`,
          }}
        >
          {place}
        </span>

        <div className="absolute top-1.5 right-1.5">
          <ScoreChip score={entry.score} mine size="md" />
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[13px] leading-snug font-semibold tracking-tight">
        {displayTitle(entry.title)}
      </p>
    </Link>
  );
}

function StatsRow({ stats }: { stats: UserStats }) {
  const cells = [
    {
      label: "Tracked",
      value: compactNumber(stats.total_entries),
      icon: <Layers className="size-3" />,
      tint: "var(--color-anime)",
    },
    {
      label: "Completed",
      value: compactNumber(stats.completed),
      icon: <CheckCheck className="size-3" />,
      tint: "var(--success)",
    },
    {
      label: "Rated",
      value: compactNumber(stats.rated_count),
      icon: <Star className="size-3" />,
      tint: "var(--color-enjoyment)",
    },
    {
      label: "Episodes",
      value: compactNumber(stats.episodes_watched),
      icon: <Film className="size-3" />,
      tint: "var(--color-craft)",
    },
    {
      label: "Chapters",
      value: compactNumber(stats.chapters_read),
      icon: <BookOpen className="size-3" />,
      tint: "var(--color-manga)",
    },
    {
      label: "Watch time",
      value: formatMinutes(stats.minutes_watched),
      icon: <Clock className="size-3" />,
      tint: "var(--color-ln)",
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {cells.map((cell) => (
        <GlassPanel
          key={cell.label}
          level="subtle"
          radius="xl"
          className="p-3.5"
          style={{
            borderColor: `color-mix(in oklch, ${cell.tint} 22%, transparent)`,
          }}
        >
          <p className="numeral text-xl leading-none sm:text-2xl">{cell.value}</p>
          <p
            className="axis-caps mt-2 flex items-center gap-1.5 truncate"
            style={{ color: cell.tint }}
          >
            {cell.icon}
            <span className="truncate">{cell.label}</span>
          </p>
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
