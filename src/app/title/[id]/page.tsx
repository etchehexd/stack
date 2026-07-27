import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";

import { FavoriteButton } from "./favorite-button";
import { RatingPad } from "@/components/rating/rating-pad";
import { RatingScatter } from "@/components/rating/rating-scatter";
import { ProgressStepper, VolumeField } from "@/components/library/progress-stepper";
import { StatusPicker } from "@/components/library/status-picker";
import { TitleCard } from "@/components/title/title-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getMyRatingPoints,
  getRelations,
  getTitle,
  getTitleRatings,
  getUserTitleState,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
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

  const [relations, communityRatings, userState, myPoints] = await Promise.all([
    getRelations(title.id),
    getTitleRatings(title.id),
    getUserTitleState(title.id),
    user ? getMyRatingPoints() : Promise.resolve([]),
  ]);

  const accent = mediaAccent(title.media_type);
  const name = displayTitle(title);
  const alt = secondaryTitle(title);
  const total = totalUnits(title);
  const readable = isReadable(title.media_type);

  const communityPoints = communityRatings.map((r) => ({
    id: r.user_id,
    enjoyment: Number(r.enjoyment),
    craft: Number(r.craft),
  }));

  const contextPoints = myPoints
    .filter((p) => p.title_id !== title.id)
    .map((p) => ({
      id: p.title_id,
      enjoyment: Number(p.enjoyment),
      craft: Number(p.craft),
    }));

  return (
    <article className="space-y-8">
      {/* --- Banner ---------------------------------------------------------- */}
      <div className="relative -mx-4 -mt-20 h-56 overflow-hidden sm:-mx-6 sm:h-72 lg:-mx-10 lg:h-80">
        {title.banner_image ? (
          <Image
            src={title.banner_image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          // No banner art: a flat wash of the cover's own dominant colour,
          // heavily muted. One hue, taken from the artwork — not a synthetic
          // multi-stop gradient.
          <div
            className="size-full opacity-25"
            style={{ background: title.cover_color ?? "var(--glass-1)" }}
          />
        )}
        {/* Scrim so the title text stays legible over any artwork. */}
        <div className="from-bg-deep via-bg-deep/80 absolute inset-0 bg-gradient-to-t to-transparent" />
      </div>

      {/* --- Header ---------------------------------------------------------- */}
      <header className="-mt-32 flex flex-col gap-6 sm:-mt-36 sm:flex-row sm:items-end">
        <div
          className="specular relative aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-lg shadow-[var(--shadow-lift)] sm:w-44"
          style={{ background: title.cover_color ?? "var(--bg-base)" }}
        >
          {title.cover_image_large && (
            <Image
              src={title.cover_image_large}
              alt={`Cover art for ${name}`}
              fill
              priority
              sizes="(max-width: 640px) 128px, 176px"
              className="object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 pb-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className="rounded-pill px-2.5 py-1 font-semibold text-white"
              style={{ background: accent }}
            >
              {MEDIA_LABEL_SINGULAR[title.media_type]}
            </span>
            <span className="glass-subtle rounded-pill px-2.5 py-1 font-medium">
              {formatLabel(title.format)}
            </span>
            <span className="glass-subtle rounded-pill px-2.5 py-1 font-medium">
              {airingStatusLabel(title.status)}
            </span>
            {title.season && title.season_year && (
              <span className="glass-subtle rounded-pill px-2.5 py-1 font-medium">
                {titleCase(title.season)} {title.season_year}
              </span>
            )}
          </div>

          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance-pretty sm:text-4xl">
            {name}
          </h1>
          {alt && <p className="text-fg-3 mt-1 text-sm">{alt}</p>}

          <div className="text-fg-2 mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            {title.average_score != null && (
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-3.5 fill-current text-[var(--color-enjoyment)]" />
                <strong className="font-semibold">{title.average_score}%</strong>
                <span className="text-fg-3">community</span>
              </span>
            )}
            {total != null && (
              <span>
                {total} {unitNoun(title.media_type, total !== 1)}
              </span>
            )}
            {title.popularity != null && (
              <span className="text-fg-3">
                {compactNumber(title.popularity)} tracking on AniList
              </span>
            )}
          </div>

          {/* --- Tracking controls ------------------------------------------ */}
          {user ? (
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
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
            </div>
          ) : (
            <div className="mt-5">
              <Link href="/login" className={buttonVariants({ variant: "primary" })}>
                Sign in to track and rate
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* --- Rating ---------------------------------------------------------- */}
      {user && (
        <GlassPanel radius="xl" className="p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold tracking-tight">Your rating</h2>
          <RatingPad
            titleId={title.id}
            initialEnjoyment={
              userState.rating?.enjoyment != null
                ? Number(userState.rating.enjoyment)
                : null
            }
            initialCraft={
              userState.rating?.craft != null ? Number(userState.rating.craft) : null
            }
            contextPoints={contextPoints}
          />
        </GlassPanel>
      )}

      {/* --- Body ------------------------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {title.synopsis && (
            <GlassPanel radius="lg" className="p-5">
              <h2 className="mb-3 text-base font-semibold tracking-tight">Synopsis</h2>
              <p className="text-fg-2 text-sm leading-relaxed whitespace-pre-line text-balance-pretty">
                {stripHtml(title.synopsis)}
              </p>
            </GlassPanel>
          )}

          {(title.genres.length > 0 || title.tags.length > 0) && (
            <GlassPanel radius="lg" className="p-5">
              <h2 className="mb-3 text-base font-semibold tracking-tight">
                Genres &amp; tags
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {title.genres.map((genre) => (
                  <Link
                    key={genre}
                    href={`/discover?genres=${encodeURIComponent(genre)}`}
                    className="rounded-pill px-2.5 py-1 text-xs font-medium text-white transition-transform duration-200 hover:scale-105"
                    style={{ background: `color-mix(in oklch, ${accent} 80%, transparent)` }}
                  >
                    {genre}
                  </Link>
                ))}
                {title.tags
                  .filter((tag) => !tag.isSpoiler)
                  .slice(0, 14)
                  .map((tag) => (
                    <span
                      key={tag.name}
                      className="glass-subtle text-fg-2 rounded-pill px-2.5 py-1 text-xs"
                      title={tag.rank ? `${tag.rank}% relevance` : undefined}
                    >
                      {tag.name}
                    </span>
                  ))}
              </div>
            </GlassPanel>
          )}

          {relations.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold tracking-tight">
                Franchise
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {relations.map((related) => (
                  <div key={`${related.id}-${related.relation_type}`}>
                    <p
                      className="mb-1.5 text-[10px] font-semibold tracking-wide uppercase"
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

        {/* --- Sidebar -------------------------------------------------------- */}
        <aside className="space-y-6">
          <GlassPanel radius="lg" className="p-5">
            <h2 className="mb-1 text-base font-semibold tracking-tight">
              How Stack rates it
            </h2>
            <p className="text-fg-3 mb-4 text-xs">
              {communityPoints.length === 0
                ? "No ratings yet — be the first."
                : `${communityPoints.length} ${communityPoints.length === 1 ? "rating" : "ratings"}, plotted on both axes.`}
            </p>
            <RatingScatter
              variant="full"
              points={communityPoints}
              active={
                userState.rating
                  ? {
                      enjoyment:
                        userState.rating.enjoyment != null
                          ? Number(userState.rating.enjoyment)
                          : null,
                      craft:
                        userState.rating.craft != null
                          ? Number(userState.rating.craft)
                          : null,
                    }
                  : null
              }
            />
          </GlassPanel>

          <GlassPanel radius="lg" className="p-5">
            <h2 className="mb-3 text-base font-semibold tracking-tight">Details</h2>
            <dl className="space-y-2.5 text-sm">
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
              {title.source && <Detail label="Source" value={titleCase(title.source)} />}
              {title.next_airing_at && (
                <Detail
                  label={`Episode ${title.next_airing_ep ?? "?"}`}
                  value={`in ${countdown(title.next_airing_at)}`}
                />
              )}
            </dl>

            {title.site_url && (
              <Link
                href={title.site_url}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: "sm", className: "mt-4 w-full" })}
              >
                View on AniList
              </Link>
            )}
          </GlassPanel>
        </aside>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-fg-3 shrink-0 text-xs">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}
