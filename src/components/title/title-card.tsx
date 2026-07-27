import Image from "next/image";
import Link from "next/link";

import { DualScore, Score } from "@/components/rating/score";
import type { MediaType } from "@/lib/types/database";
import { cn, displayTitle, formatLabel, mediaAccent } from "@/lib/utils";

export interface TitleCardData {
  id: string;
  media_type: MediaType;
  format: string | null;
  title_english: string | null;
  title_romaji: string | null;
  title_native?: string | null;
  cover_image_large: string | null;
  cover_color?: string | null;
  average_score: number | null;
  season_year: number | null;
  episodes?: number | null;
  chapters?: number | null;
  genres?: string[];
  synopsis?: string | null;
}

export interface TitleCardProps {
  title: TitleCardData;
  /** The viewer's own rating, if any. Takes over the score slot when present. */
  rating?: { enjoyment: number | null; craft: number | null } | null;
  /** Slot for a progress bar or quick-action button under the cover. */
  footer?: React.ReactNode;
  priority?: boolean;
  className?: string;
}

/**
 * A poster.
 *
 * The art is the card — everything else is a thin band along the bottom edge.
 * The score sits over the poster rather than under it so the eye lands on
 * artwork and figure together, and the artwork's own colour bleeds out behind
 * the card on hover (see `--art`), which is what stops a grid of these reading
 * as a spreadsheet of rectangles.
 */
export function TitleCard({
  title,
  rating,
  footer,
  priority = false,
  className,
}: TitleCardProps) {
  const accent = mediaAccent(title.media_type);
  const name = displayTitle(title);
  const art = title.cover_color ?? accent;
  const rated = Boolean(
    rating && (rating.enjoyment != null || rating.craft != null),
  );

  return (
    <article
      className={cn("group/card flex min-w-0 flex-col gap-2.5", className)}
      style={{ "--art": art } as React.CSSProperties}
    >
      <Link
        href={`/title/${title.id}`}
        className="art-glow art-edge lift relative block aspect-[2/3] overflow-hidden rounded-lg"
        style={{ background: art }}
      >
        {title.cover_image_large ? (
          <Image
            src={title.cover_image_large}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
            className="object-cover transition-transform duration-[600ms] [transition-timing-function:var(--ease-glass)] group-hover/card:scale-[1.05]"
          />
        ) : (
          <div className="text-fg-3 grid size-full place-items-center p-2 text-center text-xs">
            {name}
          </div>
        )}

        {/* Bottom scrim. Always on — it's what the score sits on, not a hover
            flourish — and deep enough to survive a white-heavy cover. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%]"
          style={{
            background:
              "linear-gradient(to top, oklch(0 0 0 / 0.88) 0%, oklch(0 0 0 / 0.55) 45%, transparent 100%)",
          }}
          aria-hidden
        />

        {/* Media-type hairline along the top edge. */}
        <span
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: accent }}
          aria-hidden
        />

        <div className="absolute inset-x-2.5 bottom-2.5">
          {rated ? (
            <DualScore
              enjoyment={rating!.enjoyment}
              craft={rating!.craft}
              size="xs"
            />
          ) : (
            <Score percent={title.average_score} size="sm" className="!p-0" />
          )}
        </div>
      </Link>

      <div className="min-w-0">
        <Link
          href={`/title/${title.id}`}
          className="hover:text-fg-2 line-clamp-2 text-[13px] leading-snug font-semibold tracking-tight transition-colors"
        >
          {name}
        </Link>
        <p className="text-fg-3 mt-1 flex items-center gap-1.5 text-[11px]">
          <span>{formatLabel(title.format)}</span>
          {title.season_year && (
            <>
              <span aria-hidden className="opacity-50">
                ·
              </span>
              <span className="tabular-nums">{title.season_year}</span>
            </>
          )}
        </p>
      </div>

      {footer}
    </article>
  );
}
