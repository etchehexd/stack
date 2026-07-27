import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ExternalLink, Layers, Play, Users } from "lucide-react";

import { FavoriteButton } from "./favorite-button";
import { RateButton } from "@/components/rating/rate-button";
import { RatingDistribution } from "@/components/rating/rating-distribution";
import { ScoreChip } from "@/components/rating/score-chip";
import { ProgressStepper, VolumeField } from "@/components/library/progress-stepper";
import { StatusPicker } from "@/components/library/status-picker";
import { TitleCard } from "@/components/title/title-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { getRatedCount } from "@/app/actions/rating";
import {
  getRelations,
  getTitle,
  getTitleRatings,
  getUserTitleState,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { percentToTen } from "@/lib/rating";
import {
  airingStatusLabel,
  compactNumber,
  countdown,
  displayTitle,
  formatLabel,
  isReadable,
  mediaAccent,
  MEDIA_LABEL_SINGULAR,
  secondaryTitle,
  stripHtml,
  titleCase,
  totalUnits,
  unitNoun,
} from "@/lib/utils";

export async function generateMetadata(
  props: PageProps<"/title/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const title = await getTitle(id);
  if (!title) return { title: "Not found" };

  return {
    title: displayTitle(title),
    description: stripHtml(title.synopsis).slice(0, 160),
    openGraph: {
      title: displayTitle(title),
      images: title.banner_image ? [title.banner_image] : undefined,
    },
  };
}

/**
 * A title.
 *
 * Rebuilt around one question — "is this for me, and where am I with it" — so
 * the page reads in that order: the artwork, then what people think of it
 * (a number AND the shape behind the number), then what you've done with it,
 * then the facts. The old version led with four identical stat tiles, which
 * answered none of that and looked like a database row.
 */
export default async function TitlePage(props: PageProps<"/title/[id]">) {
  const { id } = await props.params;

  const [title, user] = await Promise.all([getTitle(id), getCurrentUser()]);
  if (!title) notFound();

  const [relations, community, userState, ratedCount] = await Promise.all([
    getRelations(title.id),
    getTitleRatings(title.id),
    getUserTitleState(title.id),
    user ? getRatedCount() : Promise.resolve(0),
  ]);

  const accent = mediaAccent(title.media_type);
  const art = title.cover_color ?? accent;
  const name = displayTitle(title);
  const alt = secondaryTitle(title);
  const total = totalUnits(title);
  const readable = isReadable(title.media_type);
  const myScore =
    userState.rating?.score != null ? Number(userState.rating.score) : null;
  const catalogTen = percentToTen(title.average_score);

  return (
    <article className="pb-4" style={{ "--art": art } as React.CSSProperties}>
      {/* ===================================================================
          Hero. Full-bleed art with everything stacked over the bottom of it.
          =================================================================== */}
      <section className="relative -mx-4 -mt-[4.5rem] sm:-mx-6 lg:-mx-10">
        <div className="relative h-[26rem] overflow-hidden sm:h-[29rem] lg:h-[33rem]">
          {title.banner_image ? (
            <Image
              src={title.banner_image}
              alt=""
              fill
              priority
              sizes="100vw"
              className="scale-105 object-cover"
            />
          ) : title.cover_image_large ? (
            <Image
              src={title.cover_image_large}
              alt=""
              fill
              priority
              sizes="100vw"
              className="scale-125 object-cover blur-3xl"
            />
          ) : (
            <div className="size-full" style={{ background: art, opacity: 0.4 }} />
          )}

          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(75% 120% at 12% 60%, color-mix(in oklch, ${art} 55%, transparent) 0%, transparent 70%)`,
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--bg-deep) 3%, color-mix(in oklch, var(--bg-deep) 86%, transparent) 34%, color-mix(in oklch, var(--bg-deep) 28%, transparent) 100%)",
            }}
            aria-hidden
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-10">
          <div className="flex items-end gap-4 sm:gap-7">
            <div
              className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-2xl shadow-[var(--shadow-lift)] sm:w-40 lg:w-52"
              style={{ background: art, border: "1px solid oklch(1 0 0 / 0.18)" }}
            >
              {title.cover_image_large && (
                <Image
                  src={title.cover_image_large}
                  alt={`Cover art for ${name}`}
                  fill
                  priority
                  sizes="(max-width: 640px) 112px, (max-width: 1024px) 160px, 208px"
                  className="object-cover"
                />
              )}
              {catalogTen != null && (
                <div className="absolute top-1.5 right-1.5">
                  <ScoreChip percent={title.average_score} size="md" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="axis-caps text-fg-2 mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span style={{ color: accent }}>
                  {MEDIA_LABEL_SINGULAR[title.media_type]}
                </span>
                <Dot />
                <span>{formatLabel(title.format)}</span>
                <Dot />
                <span>{airingStatusLabel(title.status)}</span>
                {title.season_year && (
                  <>
                    <Dot />
                    <span className="tabular-nums">
                      {title.season ? `${titleCase(title.season)} ` : ""}
                      {title.season_year}
                    </span>
                  </>
                )}
              </div>

              <h1 className="page-title text-balance">{name}</h1>
              {alt && <p className="text-fg-3 mt-1.5 truncate text-sm">{alt}</p>}

              {title.genres.length > 0 && (
                <div className="mt-3.5 hidden flex-wrap gap-1.5 sm:flex">
                  {title.genres.slice(0, 5).map((genre) => (
                    <Link
                      key={genre}
                      href={`/discover?genres=${encodeURIComponent(genre)}`}
                      className="rounded-pill px-2.5 py-1 text-[11px] font-semibold transition-[transform,background] duration-200 hover:-translate-y-0.5"
                      style={{
                        color: "oklch(1 0 0 / 0.9)",
                        background: "oklch(1 0 0 / 0.12)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                      }}
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          Action bar. Every control that changes something on one line.
          =================================================================== */}
      <GlassPanel
        radius="2xl"
        className="mt-5 flex flex-wrap items-center gap-2.5 p-3 sm:px-4"
      >
        {user ? (
          <>
            <RateButton
              titleId={title.id}
              titleName={name}
              cover={title.cover_image_large}
              coverColor={title.cover_color}
              score={myScore}
              ratedCount={ratedCount}
            />
            <StatusPicker
              titleId={title.id}
              mediaType={title.media_type}
              status={userState.entry?.status ?? null}
            />
            {userState.entry && (
              <>
                <ProgressStepper
                  titleId={title.id}
                  mediaType={title.media_type}
                  total={total}
                  progress={userState.entry.progress}
                />
                {readable && (
                  <VolumeField
                    titleId={title.id}
                    value={userState.entry.progress_volumes}
                    knownTotal={title.volumes}
                  />
                )}
              </>
            )}
            <FavoriteButton titleId={title.id} initial={userState.isFavorite} />
          </>
        ) : (
          <>
            <p className="text-fg-2 flex-1 text-sm">
              Sign in to track and rate this.
            </p>
            <Link href="/login" className={buttonVariants({ variant: "primary" })}>
              Sign in
            </Link>
          </>
        )}
      </GlassPanel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {/* ===============================================================
              Scores. The catalog average is the headline; the histogram of
              Stack's own ratings sits beside it, because the shape of the
              votes says things the mean can't.
              =============================================================== */}
          <GlassPanel radius="2xl" className="p-5 sm:p-6">
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
              <div className="flex items-center gap-4 sm:flex-col sm:items-start">
                <div>
                  <p className="axis-caps text-fg-3 mb-2">Rating</p>
                  <div className="flex items-center gap-3">
                    <ScoreChip percent={title.average_score} size="lg" />
                    <div className="min-w-0">
                      <p className="text-fg-3 text-xs">out of 10</p>
                      <p className="text-fg-3 mt-0.5 text-xs tabular-nums">
                        {title.favourites != null
                          ? `${compactNumber(title.favourites)} favourites`
                          : "community average"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="sm:mt-5">
                  <p className="axis-caps text-fg-3 mb-2">Your rating</p>
                  {myScore != null ? (
                    <div className="flex items-center gap-3">
                      <ScoreChip score={myScore} mine size="lg" />
                      <p className="text-fg-3 text-xs">
                        placed by
                        <br />
                        comparison
                      </p>
                    </div>
                  ) : (
                    <p className="text-fg-3 text-sm">
                      {user ? "Not rated yet." : "Sign in to rate."}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-hairline sm:border-l sm:pl-8">
                <RatingDistribution
                  bins={community.bins}
                  count={community.count}
                  average={community.average}
                  mine={myScore}
                />
              </div>
            </div>
          </GlassPanel>

          {title.synopsis && (
            <section>
              <h2 className="panel-title mb-3">Synopsis</h2>
              <p className="text-fg-2 max-w-prose text-sm leading-relaxed whitespace-pre-line">
                {stripHtml(title.synopsis)}
              </p>
            </section>
          )}

          {(title.genres.length > 0 || title.tags.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {title.genres.map((genre) => (
                <Link
                  key={genre}
                  href={`/discover?genres=${encodeURIComponent(genre)}`}
                  className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-[transform,background] duration-200 hover:-translate-y-0.5"
                  style={{
                    color: accent,
                    borderColor: `color-mix(in oklch, ${accent} 38%, transparent)`,
                    background: `color-mix(in oklch, ${accent} 11%, transparent)`,
                  }}
                >
                  {genre}
                </Link>
              ))}
              {title.tags
                .filter((tag) => !tag.isSpoiler)
                .slice(0, 12)
                .map((tag) => (
                  <span
                    key={tag.name}
                    className="glass-subtle text-fg-3 rounded-lg px-2.5 py-1.5 text-xs"
                    title={tag.rank ? `${tag.rank}% relevance` : undefined}
                  >
                    {tag.name}
                  </span>
                ))}
            </div>
          )}

          {relations.length > 0 && (
            <section>
              <h2 className="panel-title mb-4">Franchise</h2>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 xl:grid-cols-5">
                {relations.map((related) => (
                  <div key={`${related.id}-${related.relation_type}`}>
                    <p
                      className="axis-caps mb-2 truncate"
                      style={{ color: mediaAccent(related.media_type) }}
                    >
                      {titleCase(related.relation_type)}
                    </p>
                    <TitleCard title={related} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {title.next_airing_at && (
            <GlassPanel
              level="subtle"
              radius="2xl"
              className="p-5"
              style={{
                borderColor: `color-mix(in oklch, ${accent} 40%, transparent)`,
              }}
            >
              <p className="axis-caps text-fg-3 mb-2 flex items-center gap-1.5">
                <Play className="size-3" />
                Next episode
              </p>
              <p className="numeral text-2xl leading-none" style={{ color: accent }}>
                {countdown(title.next_airing_at)}
              </p>
              <p className="text-fg-3 mt-1.5 text-xs">
                Episode {title.next_airing_ep ?? "?"} ·{" "}
                {new Date(title.next_airing_at).toLocaleDateString(undefined, {
                  weekday: "long",
                })}
              </p>
            </GlassPanel>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Fact
              icon={<Layers className="size-3" />}
              label={total != null ? unitNoun(title.media_type, total !== 1) : "Length"}
              value={total != null ? String(total) : "—"}
            />
            <Fact
              icon={<Users className="size-3" />}
              label="Tracking"
              value={title.popularity != null ? compactNumber(title.popularity) : "—"}
            />
          </div>

          <GlassPanel radius="2xl" className="p-5">
            <h2 className="panel-title mb-3 flex items-center gap-2">
              <Calendar className="text-fg-3 size-3.5" />
              Details
            </h2>
            <dl>
              <Detail label="Format" value={formatLabel(title.format)} />
              <Detail label="Status" value={airingStatusLabel(title.status)} />
              {title.episodes != null && (
                <Detail label="Episodes" value={String(title.episodes)} />
              )}
              {title.duration != null && (
                <Detail label="Episode length" value={`${title.duration} min`} />
              )}
              {title.chapters != null && (
                <Detail label="Chapters" value={String(title.chapters)} />
              )}
              {title.volumes != null && (
                <Detail label="Volumes" value={String(title.volumes)} />
              )}
              {title.start_date && <Detail label="Started" value={title.start_date} />}
              {title.end_date && <Detail label="Ended" value={title.end_date} />}
              {title.studios.length > 0 && (
                <Detail label="Studio" value={title.studios.join(", ")} />
              )}
              {title.authors.length > 0 && (
                <Detail label="Author" value={title.authors.join(", ")} />
              )}
              {title.source && (
                <Detail label="Source" value={titleCase(title.source)} />
              )}
            </dl>

            {title.site_url && (
              <Link
                href={title.site_url}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({
                  size: "sm",
                  className: "mt-4 w-full gap-1.5",
                })}
              >
                View on AniList
                <ExternalLink className="size-3.5" />
              </Link>
            )}
          </GlassPanel>
        </aside>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <GlassPanel level="subtle" radius="xl" className="p-3.5">
      <p className="axis-caps text-fg-3 mb-1.5 flex items-center gap-1.5 truncate">
        {icon}
        {label}
      </p>
      <p className="numeral text-2xl leading-none">{value}</p>
    </GlassPanel>
  );
}

function Dot() {
  return (
    <span aria-hidden className="opacity-35">
      ·
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-hairline flex items-baseline justify-between gap-4 border-b py-2.5 last:border-0">
      <dt className="text-fg-3 shrink-0 text-xs">{label}</dt>
      <dd className="text-right text-[13px] font-medium">{value}</dd>
    </div>
  );
}
