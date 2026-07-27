"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Star } from "lucide-react";

import { RatingBadge } from "@/components/rating/rating-badge";
import type { MediaType } from "@/lib/types/database";
import {
  cn,
  displayTitle,
  formatLabel,
  mediaAccent,
  stripHtml,
} from "@/lib/utils";

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
  /** The viewer's own rating, if any — shown as the two-axis badge. */
  rating?: { enjoyment: number | null; craft: number | null } | null;
  /** Slot for a progress bar or quick-action button under the cover. */
  footer?: React.ReactNode;
  priority?: boolean;
  className?: string;
}

export function TitleCard({
  title,
  rating,
  footer,
  priority = false,
  className,
}: TitleCardProps) {
  const accent = mediaAccent(title.media_type);
  const name = displayTitle(title);

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn("group flex flex-col gap-2", className)}
    >
      <Link
        href={`/title/${title.id}`}
        className="specular relative block aspect-[2/3] overflow-hidden rounded-lg"
        style={{ background: title.cover_color ?? "var(--bg-base)" }}
      >
        {title.cover_image_large ? (
          <Image
            src={title.cover_image_large}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
            className="object-cover transition-transform duration-500 [transition-timing-function:var(--ease-glass)] group-hover:scale-[1.06]"
          />
        ) : (
          <div className="text-fg-3 grid size-full place-items-center p-2 text-center text-xs">
            {name}
          </div>
        )}

        {/* Bottom scrim so overlaid text stays legible on bright covers */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Media-type accent bar */}
        <span
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: accent }}
          aria-hidden
        />

        {title.average_score != null && (
          <span className="glass-heavy absolute top-2 right-2 inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            <Star className="size-2.5 fill-current" />
            {title.average_score}
          </span>
        )}

        {rating && (rating.enjoyment != null || rating.craft != null) && (
          <div className="glass-heavy absolute right-2 bottom-2 left-2 rounded-sm px-2 py-1">
            <RatingBadge
              enjoyment={rating.enjoyment}
              craft={rating.craft}
              size="xs"
            />
          </div>
        )}

        {title.synopsis && (
          <div className="glass-heavy pointer-events-none absolute inset-0 flex flex-col justify-end p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 max-lg:hidden">
            <p className="line-clamp-6 text-[11px] leading-relaxed text-white/85">
              {stripHtml(title.synopsis)}
            </p>
          </div>
        )}
      </Link>

      <div className="min-w-0">
        <Link
          href={`/title/${title.id}`}
          className="hover:text-fg-2 line-clamp-2 text-sm leading-snug font-medium transition-colors"
        >
          {name}
        </Link>
        <p className="text-fg-3 mt-0.5 flex items-center gap-1.5 text-xs">
          <span>{formatLabel(title.format)}</span>
          {title.season_year && (
            <>
              <span aria-hidden>·</span>
              <span>{title.season_year}</span>
            </>
          )}
        </p>
      </div>

      {footer}
    </motion.article>
  );
}
