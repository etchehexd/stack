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
  /** Position in a ranked shelf. Drawn as an outlined numeral over the art. */
  rank?: number;
  footer?: React.ReactNode;
  priority?: boolean;
  className?: string;
}

/**
 * A poster.
 *
 * The art carries two things and no more: the score dial top right, and a rank
 * numeral bottom left when the shelf is ranked. Top right is reserved for the
 * score everywhere in the app — it is the one place your eye can go on any
 * card, on any page, and find the same fact.
 *
 * Everything else is hover state: the artwork pushes in, its own sampled colour
 * washes up from the bottom, and the genres fade in. Idle, the wall of posters
 * stays quiet; the card you're pointing at is the only one doing anything.
 */
export function TitleCard({
  title,
  score,
  rank,
  footer,
  priority = false,
  className,
}: TitleCardProps) {
  const accent = mediaAccent(title.media_type);
  const name = displayTitle(title);
  const art = title.cover_color ?? accent;
  const genres = title.genres?.slice(0, 2) ?? [];

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
            sizes="(max-width: 640px) 40vw, 220px"
            className="object-cover transition-transform duration-[700ms] [transition-timing-function:var(--ease-glass)] group-hover/card:scale-[1.07]"
          />
        ) : (
          <div className="text-fg-3 grid size-full place-items-center p-2 text-center text-xs">
            {name}
          </div>
        )}

        {/* Idle scrim: bottom third only, and only enough to seat the rank
            numeral and keep the hover chips off bare artwork. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
          style={{
            background:
              "linear-gradient(to top, oklch(0 0 0 / 0.72) 0%, oklch(0 0 0 / 0.22) 55%, transparent 100%)",
          }}
          aria-hidden
        />

        {/* Hover wash in the artwork's own colour. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
          style={{
            background: `linear-gradient(to top, color-mix(in oklch, var(--art) 55%, oklch(0 0 0 / 0.85)) 0%, transparent 48%)`,
          }}
          aria-hidden
        />

        <div className="absolute top-1.5 right-1.5">
          {score != null ? (
            <ScoreChip score={score} mine size="md" />
          ) : (
            <ScoreChip percent={title.average_score} size="md" />
          )}
        </div>

        {rank != null && (
          <span className="rank-numeral absolute bottom-0 left-1.5" aria-hidden>
            {rank}
          </span>
        )}

        {/* Ranked cards keep their corner for the numeral — two things fighting
            over the bottom left is worse than losing the genres on ten posters. */}
        {rank == null && genres.length > 0 && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex translate-y-1 flex-wrap gap-1 opacity-0 transition-[opacity,transform] duration-400 [transition-timing-function:var(--ease-glass)] group-hover/card:translate-y-0 group-hover/card:opacity-100">
            {genres.map((genre) => (
              <span
                key={genre}
                className="rounded-pill px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide"
                style={{
                  background: "oklch(1 0 0 / 0.16)",
                  color: "oklch(1 0 0 / 0.95)",
                  backdropFilter: "blur(var(--blur-glass-1))",
                }}
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </Link>

      <div className="min-w-0">
        <Link
          href={`/title/${title.id}`}
          className="hover:text-fg-2 line-clamp-2 text-[13px] leading-snug font-semibold tracking-tight transition-colors"
        >
          {name}
        </Link>
        <p className="text-fg-3 mt-1 flex items-center gap-1.5 text-[11px]">
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden
          />
          <span className="truncate">{formatLabel(title.format)}</span>
          {title.season_year && (
            <>
              <span aria-hidden className="opacity-40">
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
