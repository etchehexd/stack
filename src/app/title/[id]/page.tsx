import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Users } from "lucide-react";

import { FavoriteButton } from "./favorite-button";
import { RatingPad } from "@/components/rating/rating-pad";
import { DualScore, Score } from "@/components/rating/score";
import { ProgressStepper, VolumeField } from "@/components/library/progress-stepper";
import { StatusPicker } from "@/components/library/status-picker";
import { TitleCard } from "@/components/title/title-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getRelations,
  getTitle,
  getTitleRatings,
  getUserTitleState,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { AXIS_META, formatTen } from "@/lib/rating";
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

export default async function TitlePage(props: PageProps<"/title/[id]">) {
  const { id } = await props.params;

  const [title, user] = await Promise.all([getTitle(id), getCurrentUser()]);
  if (!title) notFound();

  const [relations, communityRatings, userState] = await Promise.all([
    getRelations(title.id),
    getTitleRatings(title.id),
    getUserTitleState(title.id),
  ]);

  const accent = mediaAccent(title.media_type);
  const art = title.cover_color ?? accent;
  const name = displayTitle(title);
  const alt = secondaryTitle(title);
  const total = totalUnits(title);
  const readable = isReadable(title.media_type);

  const myRating = userState.rating
    ? {
        enjoyment:
          userState.rating.enjoyment != null
            ? Number(userState.rating.enjoyment)
            : null,
        craft:
          userState.rating.craft != null ? Number(userState.rating.craft) : null,
      }
    : null;

  // Stack's own averages. Two numbers, computed here because this is the only
  // page that shows them.
  const stackAverage = averageOf(communityRatings);

  return (
    <article
      className="space-y-10"
      style={{ "--art": art } as React.CSSProperties}
    >
      {/* ===== Hero ========================================================= */}
      <section className="relative -mx-4 -mt-20 sm:-mx-6 lg:-mx-10">
        <div className="relative h-[380px] overflow-hidden sm:h-[440px] lg:h-[500px]">
          {title.banner_image ? (
            <Image
              src={title.banner_image}
              alt=""
              fill
              priority
              sizes="100vw"
              className="scale-105 object-cover blur-[2px]"
            />
          ) : (
            <div className="size-full" style={{ background: art, opacity: 0.35 }} />
          )}

          {/* Two scrims doing different jobs: a wash of the artwork's own
              colour to tie the header to the poster, and a hard vertical fade
              so the type below it is legible over anything. */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(115deg, color-mix(in oklch, ${art} 55%, transparent) 0%, transparent 62%)`,
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--bg-deep) 4%, color-mix(in oklch, var(--bg-deep) 78%, transparent) 42%, color-mix(in oklch, var(--bg-deep) 30%, transparent) 100%)",
            }}
            aria-hidden
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-1 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-7">
            <div
              className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl shadow-[var(--shadow-lift)] sm:w-40 lg:w-48"
              style={{
                background: art,
                border: "1px solid oklch(1 0 0 / 0.14)",
              }}
            >
              {title.cover_image_large && (
                <Image
                  src={title.cover_image_large}
                  alt={`Cover art for ${name}`}
                  fill
                  priority
                  sizes="(max-width: 640px) 112px, (max-width: 1024px) 160px, 192px"
                  className="object-cover"
                />
              )}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="axis-caps text-fg-2 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span style={{ color: accent }}>
                  {MEDIA_LABEL_SINGULAR[title.media_type]}
                </span>
                <Dot />
                <span>{formatLabel(title.format)}</span>
                <Dot />
                <span>{airingStatusLabel(title.status)}</span>
                {title.season && title.season_year && (
                  <>
                    <Dot />
                    <span>
                      {titleCase(title.season)} {title.season_year}
                    </span>
                  </>
                )}
              </div>

              <h1 className="page-title text-balance-pretty">{name}</h1>
              {alt && <p className="text-fg-3 mt-2 text-sm">{alt}</p>}

              <div className="mt-4 flex flex-wrap items-end gap-x-7 gap-y-3">
                {title.average_score != null && (
                  <div>
                    <p className="axis-caps text-fg-3 mb-0.5">AniList</p>
                    <Score percent={title.average_score} size="lg" />
                  </div>
                )}

                {stackAverage && (
                  <div>
                    <p className="axis-caps text-fg-3 mb-1.5">
                      Stack · {communityRatings.length}
                    </p>
                    <div className="flex items-baseline gap-3">
                      <BigAxis
                        value={stackAverage.enjoyment}
                        color={AXIS_META.enjoyment.color}
                      />
                      <span className="text-fg-3 text-xl opacity-30">/</span>
                      <BigAxis
                        value={stackAverage.craft}
                        color={AXIS_META.craft.color}
                      />
                    </div>
                  </div>
                )}

                <div className="text-fg-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  {total != null && (
                    <span className="tabular-nums">
                      {total} {unitNoun(title.media_type, total !== 1)}
                    </span>
                  )}
                  {title.popularity != null && (
                    <span className="text-fg-3 inline-flex items-center gap-1.5 tabular-nums">
                      <Users className="size-3.5" />
                      {compactNumber(title.popularity)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Tracking bar ================================================= */}
      {user ? (
        <GlassPanel
          radius="xl"
          className="flex flex-wrap items-center gap-2.5 p-3 sm:px-4"
        >
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

          {myRating && (
            <div className="ml-auto flex items-center gap-4 pr-1">
              <span className="axis-caps text-fg-3 hidden sm:block">You</span>
              <DualScore
                enjoyment={myRating.enjoyment}
                craft={myRating.craft}
                size="sm"
                className="w-32"
              />
            </div>
          )}
        </GlassPanel>
      ) : (
        <GlassPanel
          radius="xl"
          className="flex flex-wrap items-center justify-between gap-4 p-5"
        >
          <p className="text-fg-2 text-sm">
            Sign in to track this and rate it on both axes.
          </p>
          <Link href="/login" className={buttonVariants({ variant: "primary" })}>
            Sign in
          </Link>
        </GlassPanel>
      )}

      {/* ===== Body ========================================================= */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {user && (
            <GlassPanel radius="xl" className="p-5 sm:p-6">
              <h2 className="panel-title mb-5">Your rating</h2>
              <RatingPad
                titleId={title.id}
                initialEnjoyment={myRating?.enjoyment ?? null}
                initialCraft={myRating?.craft ?? null}
              />
            </GlassPanel>
          )}

          {title.synopsis && (
            <GlassPanel radius="xl" className="p-5 sm:p-6">
              <h2 className="panel-title mb-3">Synopsis</h2>
              <p className="text-fg-2 text-sm leading-relaxed whitespace-pre-line">
                {stripHtml(title.synopsis)}
              </p>
            </GlassPanel>
          )}

          {(title.genres.length > 0 || title.tags.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {title.genres.map((genre) => (
                <Link
                  key={genre}
                  href={`/discover?genres=${encodeURIComponent(genre)}`}
                  className="rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors duration-200"
                  style={{
                    color: accent,
                    borderColor: `color-mix(in oklch, ${accent} 40%, transparent)`,
                    background: `color-mix(in oklch, ${accent} 12%, transparent)`,
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
                    className="glass-subtle text-fg-3 rounded-pill px-3 py-1.5 text-xs"
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {relations.map((related) => (
                  <div key={`${related.id}-${related.relation_type}`}>
                    <p
                      className="axis-caps mb-2"
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

        {/* ===== Sidebar ==================================================== */}
        <aside>
          <GlassPanel radius="xl" className="p-5">
            <h2 className="panel-title mb-4">Details</h2>
            <dl className="space-y-0">
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
              {title.next_airing_at && (
                <Detail
                  label={`Episode ${title.next_airing_ep ?? "?"}`}
                  value={countdown(title.next_airing_at)}
                  highlight
                />
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
                AniList
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

function averageOf(
  ratings: { enjoyment: number | string; craft: number | string }[],
) {
  if (ratings.length === 0) return null;
  const n = ratings.length;
  return {
    enjoyment: ratings.reduce((a, r) => a + Number(r.enjoyment), 0) / n,
    craft: ratings.reduce((a, r) => a + Number(r.craft), 0) / n,
  };
}

function BigAxis({ value, color }: { value: number; color: string }) {
  return (
    <span className="numeral text-3xl leading-none sm:text-4xl" style={{ color }}>
      {formatTen(value)}
    </span>
  );
}

function Dot() {
  return (
    <span aria-hidden className="opacity-35">
      ·
    </span>
  );
}

function Detail({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="border-hairline flex items-baseline justify-between gap-4 border-b py-2.5 last:border-0">
      <dt className="text-fg-3 shrink-0 text-xs">{label}</dt>
      <dd
        className="text-right text-[13px] font-medium"
        style={highlight ? { color: "var(--accent)" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
