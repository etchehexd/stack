import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TitleCard, type TitleCardData } from "./title-card";
import { cn } from "@/lib/utils";

/**
 * One horizontal row of posters, full page width.
 *
 * This is the only shelf primitive. Rows never sit beside each other — the
 * page is a stack of them — so each one gets the full width and there's a
 * single scroll direction per line.
 */
export function TitleRow({
  heading,
  eyebrow,
  titles,
  ratings,
  href,
  accent,
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
  /** Eager-load the first few covers. Use on the topmost row only. */
  priority?: boolean;
  className?: string;
}) {
  if (titles.length === 0) return null;

  return (
    <section className={cn("min-w-0", className)}>
      <header className="mb-4 flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {accent && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
              aria-hidden
            />
          )}
          <div className="min-w-0">
            {eyebrow && <p className="axis-caps text-fg-3 mb-1">{eyebrow}</p>}
            <h2 className="truncate text-lg font-bold tracking-tight sm:text-xl">
              {heading}
            </h2>
          </div>
        </div>

        {href && (
          <Link
            href={href}
            className="text-fg-3 hover:text-fg inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition-colors"
          >
            All
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </header>

      {/* The negative margin lets the row bleed to the screen edge on mobile
          so posters don't visibly stop short of it, while the padding keeps
          the first one aligned with the heading. */}
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {titles.map((title, i) => (
          <TitleCard
            key={title.id}
            title={title}
            score={ratings?.get(title.id) ?? null}
            priority={priority && i < 6}
            className="w-[38vw] shrink-0 snap-start sm:w-36 lg:w-[9.5rem] xl:w-40"
          />
        ))}
      </div>
    </section>
  );
}
