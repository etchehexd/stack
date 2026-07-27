import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DiscoverFilters } from "./filters";
import { DiscoverResults } from "./results";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { getFacets, getRatingsMap, searchTitles } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import type { MediaType } from "@/lib/types/database";
import { parseTriSet } from "@/lib/tri-state";

export const metadata: Metadata = {
  title: "Discover",
  description: "Search and filter every anime, manga and light novel in the catalog.",
};

const PAGE_SIZE = 42;

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

  const query = first("q");

  /*
    The filter set is built once and handed to the client as-is, so the
    "load more" action asks for the next slice of exactly this search rather
    than re-deriving it from a URL the client would have to parse again.
  */
  const filters = {
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
  };

  const [{ results, total }, facets, user] = await Promise.all([
    searchTitles({ ...filters, limit: PAGE_SIZE, offset: 0 }),
    getFacets(),
    getCurrentUser(),
  ]);

  // Every score this viewer has given — the whole map, not just this page's
  // worth, so the infinite grid can label rows it fetches later without
  // another round trip.
  const ratings = user
    ? Object.fromEntries(await getRatingsMap(user.id))
    : {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Discover</h1>
        <p className="text-fg-3 mt-2 text-sm">
          {query ? `Results for “${query}”` : `${total.toLocaleString()} titles`}
        </p>
      </div>

      <Suspense fallback={<GlassPanel radius="xl" className="h-20" />}>
        <DiscoverFilters facets={facets} total={total} />
      </Suspense>

      {results.length === 0 ? (
        <NoResults query={query} />
      ) : (
        <DiscoverResults
          initial={results}
          total={total}
          params={filters}
          pageSize={PAGE_SIZE}
          ratings={ratings}
        />
      )}
    </div>
  );
}

function NoResults({ query }: { query?: string }) {
  return (
    <GlassPanel radius="xl" className="p-10 text-center">
      <h2 className="text-lg font-bold tracking-tight">Nothing matched</h2>
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
