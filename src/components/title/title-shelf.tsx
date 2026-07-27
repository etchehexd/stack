import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { TitleCard, type TitleCardData } from "./title-card";
import { cn } from "@/lib/utils";

export function TitleShelf({
  heading,
  subheading,
  titles,
  href,
  accent,
  layout = "row",
  className,
}: {
  heading: string;
  subheading?: string;
  titles: TitleCardData[];
  href?: string;
  accent?: string;
  /** "row" scrolls horizontally; "grid" wraps. */
  layout?: "row" | "grid";
  className?: string;
}) {
  if (titles.length === 0) return null;

  return (
    <section className={cn("min-w-0", className)}>
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
          {accent && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: accent }}
              aria-hidden
            />
          )}
          <h2 className="truncate text-base font-semibold tracking-tight">
            {heading}
          </h2>
          {subheading && (
            <span className="text-fg-3 hidden truncate text-xs sm:inline">
              {subheading}
            </span>
          )}
        </div>

        {href && (
          <Link
            href={href}
            className="text-fg-3 hover:text-fg inline-flex shrink-0 items-center gap-0.5 text-xs font-medium transition-colors"
          >
            See all
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </header>

      {layout === "row" ? (
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {titles.map((title) => (
            <TitleCard
              key={title.id}
              title={title}
              className="w-[42vw] shrink-0 snap-start sm:w-40 lg:w-44"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {titles.map((title) => (
            <TitleCard key={title.id} title={title} />
          ))}
        </div>
      )}
    </section>
  );
}
