import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Users } from "lucide-react";

import { FavoriteButton } from "./favorite-button";
import { RateButton } from "@/components/rating/rate-button";
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
import { formatPercentAsTen, formatScore, scoreColor } from "@/lib/rating";
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

  return (
    <article
      className="pb-4"
      style={{ "--art": art } as React.CSSProperties}
    >
      {/* ===================================================================
          Hero. Full-bleed art, everything else stacked over the bottom of it.
          One column, so on a phone the poster, the title and the numbers read
          top to bottom instead of fighting for a narrow row.
          =================================================================== */}
      <section className="relative -mx-4 -mt-[4.5rem] sm:-mx-6 lg:-mx-10">
        <div className="relative h-[420px] overflow-hidden sm:h-[460px] lg:h-[520px]">
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
              background: `linear-gradient(105deg, color-mix(in oklch, ${art} 62%, transparent) 0%, transparent 58%)`,
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--bg-deep) 2%, color-mix(in oklch, var(--bg-deep) 82%, transparent) 38%, color-mix(in oklch, var(--bg-deep) 25%, transparent) 100%)",
            }}
            aria-hidden
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-10">
          <div className="flex items-end gap-4 sm:gap-7">
            <div
              className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-2xl shadow-[var(--shadow-lift)] sm:w-40 lg:w-48"
              style={{ background: art, border: "1px solid oklch(1 0 0 / 0.16)" }}
            >
              {title.cover_image_large && (
                <Image
                  src={title.cover_image_large}
                  alt={`Cover art for ${name}`}
                  fill
                  priority
                  sizes="(max-width: 640px) 96px, (max-width: 1024px) 160px, 192px"
                  className="object-cover"
                />
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

              <h1 className="page-title text-balance-pretty">{name}</h1>
              {alt && (
                <p className="text-fg-3 mt-1.5 truncate text-sm">{alt}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          Action bar. Every control that changes something lives on this one
          line, directly under the hero — you never have to hunt the page for
          the thing that rates or tracks.
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

      {/* ===================================================================
          Scores. Three figures on one strip, biggest first.
          =================================================================== */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="AniList"
          value={formatPercentAsTen(title.average_score)}
          color={
            title.average_score != null
              ? scoreColor(title.average_score / 10)
              : undefined
          }
        />
        <Stat
          label={`Stack · ${community.count}`}
          value={community.average != null ? formatScore(community.average) : "—"}
          color={
            community.average != null ? scoreColor(community.average) : undefined
          }
        />
        <Stat
          label={total != null ? unitNoun(title.media_type, total !== 1) : "Length"}
          value={total != null ? String(total) : "—"}
        />
        <Stat
          label="Tracking"
          value={
            title.popularity != null ? compactNumber(title.popularity) : "—"
          }
          icon={<Users className="size-3.5" />}
        />
      </div>

      {/* ===================================================================
          Body.
          =================================================================== */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
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

        <aside>
          <GlassPanel radius="2xl" className="p-5">
            <h2 className="panel-title mb-3">Details</h2>
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

function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <GlassPanel level="subtle" radius="xl" className="p-3.5">
      <p className="axis-caps text-fg-3 mb-1.5 flex items-center gap-1.5 truncate">
        {icon}
        {label}
      </p>
      <p className="numeral text-2xl leading-none sm:text-3xl" style={{ color }}>
        {value}
      </p>
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
