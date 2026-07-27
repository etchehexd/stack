import Image from "next/image";
import Link from "next/link";

import { ScoreChip } from "@/components/rating/score-chip";
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
  /** The viewer's own 0–10 score. Replaces the catalog average when present. */
  score?: number | null;
  footer?: React.ReactNode;
  priority?: boolean;
  className?: string;
}

/**
 * A poster.
 *
 * The score sits in the bottom-left corner of the art as a bare numeral with a
 * short colour rule under it — no pill, no plate, no background. That keeps it
 * to roughly two characters' worth of the poster while still being the first
 * thing you can read, because it's the only text on the image.
 *
 * A viewer's own score displaces the catalog average and is drawn in its band
 * colour rather than white, so the two can never be mistaken for each other.
 */
export function TitleCard({
  title,
  score,
  footer,
  priority = false,
  className,
}: TitleCardProps) {
  const accent = mediaAccent(title.media_type);
  const name = displayTitle(title);
  const art = title.cover_color ?? accent;

  return (
    <article
      className={cn("group/card flex min-w-0 flex-col gap-2.5", className)}
      style={{ "--art": art } as React.CSSProperties}
    >
      <Link
        href={`/title/${title.id}`}
        className="art-glow art-edge lift relative block aspect-[2/3] overflow-hidden rounded-xl"
        style={{ background: art }}
      >
        {title.cover_image_large ? (
          <Image
            src={title.cover_image_large}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 40vw, 200px"
            className="object-cover transition-transform duration-[600ms] [transition-timing-function:var(--ease-glass)] group-hover/card:scale-[1.06]"
          />
        ) : (
          <div className="text-fg-3 grid size-full place-items-center p-2 text-center text-xs">
            {name}
          </div>
        )}

        {/* Just enough scrim to carry the numeral, kept to the bottom third. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%]"
          style={{
            background:
              "linear-gradient(to top, oklch(0 0 0 / 0.82) 0%, oklch(0 0 0 / 0.35) 55%, transparent 100%)",
          }}
          aria-hidden
        />

        <span
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: accent }}
          aria-hidden
        />

        <div className="absolute bottom-2 left-2.5">
          {score != null ? (
            <ScoreChip score={score} mine size="md" />
          ) : (
            <ScoreChip percent={title.average_score} size="md" />
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
