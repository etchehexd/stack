import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TitleCard, type TitleCardData } from "./title-card";
import { cn } from "@/lib/utils";

const WIDTHS = {
  md: "w-[38vw] sm:w-36 lg:w-[9.5rem] xl:w-40",
  lg: "w-[44vw] sm:w-44 lg:w-48 xl:w-52",
} as const;

/**
 * One horizontal row of posters, full page width.
 *
 * This is the only shelf primitive. Rows never sit beside each other — the
 * page is a stack of them — so each one gets the full width and there's a
 * single scroll direction per line.
 *
 * The header carries the row's accent as a short bar rather than a dot: at
 * eight rows down a page, the eye picks up the colour band as "new section"
 * before it reads the words, which is what stops a long stack of shelves
 * reading as one undifferentiated list.
 */
export function TitleRow({
  heading,
  eyebrow,
  titles,
  ratings,
  href,
  accent,
  ranked = false,
  size = "md",
  priority = false,
  className,
}: {
  heading: string;
  eyebrow?: string;
  titles: TitleCardData[];
  /** title id → the viewer's 0–10 score. */
  ratings?: Map<string, number>;
  href?: string;
  accent?: string;
  /** Numbers the posters 1..n with an outlined numeral over the art. */
  ranked?: boolean;
  size?: keyof typeof WIDTHS;
  /** Eager-load the first few covers. Use on the topmost row only. */
  priority?: boolean;
  className?: string;
}) {
  if (titles.length === 0) return null;

  return (
    <section className={cn("min-w-0", className)}>
      <header className="mb-3.5 flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-7 w-[3px] shrink-0 rounded-pill sm:h-8"
            style={{
              background: accent ?? "var(--glass-border-strong)",
              boxShadow: accent ? `0 0 14px -2px ${accent}` : undefined,
            }}
            aria-hidden
          />
          <div className="min-w-0">
            {eyebrow && <p className="axis-caps text-fg-3 mb-0.5">{eyebrow}</p>}
            <h2 className="truncate text-lg font-bold tracking-[-0.02em] sm:text-xl">
              {heading}
            </h2>
          </div>
        </div>

        {href && (
          <Link
            href={href}
            className="glass-subtle specular glass-press text-fg-2 hover:text-fg group/all inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-semibold"
          >
            See all
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover/all:translate-x-0.5" />
          </Link>
        )}
      </header>

      {/* The negative margin lets the row bleed to the screen edge on mobile
          so posters don't visibly stop short of it, while the padding keeps
          the first one aligned with the heading. The mask fades the trailing
          edge so a row that continues off-screen looks like it continues. */}
      <div className="shelf-fade no-scrollbar -mx-4 flex snap-x gap-3.5 overflow-x-auto px-4 pt-1 pb-2 sm:mx-0 sm:px-0">
        {titles.map((title, i) => (
          <TitleCard
            key={title.id}
            title={title}
            score={ratings?.get(title.id) ?? null}
            rank={ranked ? i + 1 : undefined}
            priority={priority && i < 6}
            className={cn("shrink-0 snap-start", WIDTHS[size])}
          />
        ))}
      </div>
    </section>
  );
}
