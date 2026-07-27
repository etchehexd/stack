import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DiscoverFilters } from "./filters";
import { TitleCard } from "@/components/title/title-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button";
import { getFacets, searchTitles } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { getRatingsMap } from "@/lib/queries";
import type { MediaType } from "@/lib/types/database";
import { parseTriSet } from "@/components/ui/tri-state-chip";

export const metadata: Metadata = {
  title: "Discover",
  description: "Search and filter every anime, manga and light novel in the catalog.",
};

const PAGE_SIZE = 40;

export default async function DiscoverPage(props: PageProps<"/discover">) {
  const sp = await props.searchParams;

  const first = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const num = (key: string) => {
    const v = Number(first(key));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };

  const genres = parseTriSet(first("genres"));
  const formats = parseTriSet(first("formats"));
  const statuses = parseTriSet(first("status"));
  const people = parseTriSet(first("people"));

  const page = num("page") ?? 1;
  const query = first("q");

  const params = {
    query,
    mediaTypes: (first("media")?.split(",").filter(Boolean) ?? []) as MediaType[],
    formats: formats.include,
    excludeFormats: formats.exclude,
    statuses: statuses.include,
    excludeStatuses: statuses.exclude,
    includeGenres: genres.include,
    excludeGenres: genres.exclude,
    includeStudios: people.include,
    excludeStudios: people.exclude,
    yearMin: num("year_min"),
    yearMax: num("year_max"),
    season: first("season"),
    countMin: num("count_min"),
    countMax: num("count_max"),
    scoreMin: num("score_min"),
    // Relevance ordering is implicit whenever there's a query, so only pass an
    // explicit sort when the user picked one.
    sort: first("sort") ?? (query ? "relevance" : "popularity"),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const [{ results, total }, facets, user] = await Promise.all([
    searchTitles(params),
    getFacets(),
    getCurrentUser(),
  ]);

  const ratings = user ? await getRatingsMap(user.id) : new Map();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="text-fg-3 mt-1 text-sm">
          {query
            ? `Results for “${query}”`
            : "Everything in the catalog, filtered however you like."}
        </p>
      </div>

      <Suspense fallback={<GlassPanel radius="xl" className="h-20" />}>
        <DiscoverFilters facets={facets} total={total} />
      </Suspense>

      {results.length === 0 ? (
        <NoResults query={query} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {results.map((result, i) => (
              <TitleCard
                key={result.id}
                title={result}
                rating={ratings.get(result.id) ?? null}
                priority={i < 6}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} searchParams={sp} />
          )}
        </>
      )}
    </div>
  );
}

function NoResults({ query }: { query?: string }) {
  return (
    <GlassPanel radius="xl" className="p-10 text-center">
      <h2 className="text-lg font-semibold">Nothing matched</h2>
      <p className="text-fg-3 mx-auto mt-2 max-w-md text-sm leading-relaxed">
        {query
          ? `No titles came close to “${query}”. Search is typo-tolerant, so if this is a real title it may just not be in the catalog yet — run a deeper sync to pull more.`
          : "Your filters excluded everything. Try clearing a few chips."}
      </p>
      <Link href="/discover" className={buttonVariants({ size: "md", className: "mt-5" })}>
        Clear filters
      </Link>
    </GlassPanel>
  );
}

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  function hrefFor(target: number) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value == null) continue;
      next.set(key, Array.isArray(value) ? value[0] : value);
    }
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `/discover?${qs}` : "/discover";
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-3 pt-2"
    >
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={buttonVariants({ size: "sm" })}>
          Previous
        </Link>
      )}
      <span className="text-fg-3 text-xs tabular-nums">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} className={buttonVariants({ size: "sm" })}>
          Next
        </Link>
      )}
    </nav>
  );
}
