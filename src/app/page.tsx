import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TitleRow } from "@/components/title/title-row";
import { ScoreChip } from "@/components/rating/score-chip";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getRatingsMap,
  getRecommendations,
  getShelf,
  getThisSeason,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  currentSeason,
  displayTitle,
  mediaAccent,
  MEDIA_LABEL,
  stripHtml,
  titleCase,
} from "@/lib/utils";

export default async function HomePage() {
  const user = await getCurrentUser();
  const { season, year } = currentSeason();

  const [
    thisSeason,
    animePopular,
    animeTop,
    mangaPopular,
    mangaTop,
    lnPopular,
    lnTop,
    recs,
    ratings,
  ] = await Promise.all([
    getThisSeason(18),
    getShelf("anime", "popular"),
    getShelf("anime", "top_rated"),
    getShelf("manga", "popular"),
    getShelf("manga", "top_rated"),
    getShelf("light_novel", "popular"),
    getShelf("light_novel", "top_rated"),
    user ? getRecommendations(user.id, 12) : Promise.resolve([]),
    user ? getRatingsMap(user.id) : Promise.resolve(new Map<string, number>()),
  ]);

  const empty =
    thisSeason.length === 0 && animePopular.length === 0 && mangaPopular.length === 0;
  if (empty) return <EmptyCatalog />;

  const [lead, ...rest] = thisSeason;

  /*
    One row per idea, stacked. The previous version put "Most popular" and
    "Highest rated" side by side in a two-column grid, which halved every
    poster and meant two competing scroll directions on one line. Rows are
    boring in the right way: your eye goes down the page, and each row gets the
    full width to itself.
  */
  return (
    <div className="space-y-12">
      {!user && <Hero />}

      {lead && <Feature title={lead} season={season} year={year} />}

      {recs.length > 0 && (
        <TitleRow heading="For you" titles={recs} ratings={ratings} />
      )}

      {rest.length > 0 && (
        <TitleRow
          heading="Airing now"
          eyebrow={`${titleCase(season)} ${year}`}
          titles={rest}
          ratings={ratings}
          href={`/discover?media=anime&season=${season}&year_min=${year}&year_max=${year}`}
          priority
        />
      )}

      <TitleRow
        heading="Popular anime"
        titles={animePopular}
        ratings={ratings}
        accent={mediaAccent("anime")}
        href="/discover?media=anime&sort=popularity"
      />
      <TitleRow
        heading="Top rated anime"
        titles={animeTop}
        ratings={ratings}
        accent={mediaAccent("anime")}
        href="/discover?media=anime&sort=score"
      />
      <TitleRow
        heading={`Popular ${MEDIA_LABEL.manga.toLowerCase()}`}
        titles={mangaPopular}
        ratings={ratings}
        accent={mediaAccent("manga")}
        href="/discover?media=manga&sort=popularity"
      />
      <TitleRow
        heading={`Top rated ${MEDIA_LABEL.manga.toLowerCase()}`}
        titles={mangaTop}
        ratings={ratings}
        accent={mediaAccent("manga")}
        href="/discover?media=manga&sort=score"
      />
      <TitleRow
        heading={`Popular ${MEDIA_LABEL.light_novel.toLowerCase()}`}
        titles={lnPopular}
        ratings={ratings}
        accent={mediaAccent("light_novel")}
        href="/discover?media=light_novel&sort=popularity"
      />
      <TitleRow
        heading={`Top rated ${MEDIA_LABEL.light_novel.toLowerCase()}`}
        titles={lnTop}
        ratings={ratings}
        accent={mediaAccent("light_novel")}
        href="/discover?media=light_novel&sort=score"
      />
    </div>
  );
}

/**
 * The season's most-tracked title, full width.
 *
 * Everything below this is a row of posters at the same size, so the page
 * needs one thing that isn't — otherwise there's no entry point and the eye
 * just slides off. The panel is tinted with this title's own cover colour, so
 * the top of the page looks different every season rather than looking like a
 * template with the pictures swapped.
 */
function Feature({
  title,
  season,
  year,
}: {
  title: Awaited<ReturnType<typeof getThisSeason>>[number];
  season: string;
  year: number;
}) {
  const accent = mediaAccent(title.media_type);
  const art = title.cover_color ?? accent;
  const name = displayTitle(title);
  const blurb = stripHtml(title.synopsis ?? "").slice(0, 220);

  return (
    <section
      className="relative isolate overflow-hidden rounded-3xl"
      style={{ background: "var(--glass-2)" }}
    >
      {title.cover_image_large && (
        <Image
          src={title.cover_image_large}
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-125 object-cover opacity-30 blur-3xl"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(96deg, color-mix(in oklch, ${art} 55%, transparent) 0%, color-mix(in oklch, var(--bg-deep) 55%, transparent) 62%)`,
        }}
        aria-hidden
      />

      <div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-9 sm:p-9">
        <Link
          href={`/title/${title.id}`}
          className="relative aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-2xl shadow-[var(--shadow-lift)] transition-transform duration-500 hover:-translate-y-1 sm:w-48"
          style={{ background: art, border: "1px solid oklch(1 0 0 / 0.16)" }}
        >
          {title.cover_image_large && (
            <Image
              src={title.cover_image_large}
              alt=""
              fill
              priority
              sizes="192px"
              className="object-cover"
            />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <p className="axis-caps text-fg-2 mb-3">
            <span style={{ color: accent }}>
              {titleCase(season)} {year}
            </span>
            <span className="mx-2 opacity-40">·</span>
            Most tracked
          </p>

          <h2 className="page-title text-balance-pretty">
            <Link
              href={`/title/${title.id}`}
              className="transition-opacity hover:opacity-75"
            >
              {name}
            </Link>
          </h2>

          {blurb && (
            <p className="text-fg-2 mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed sm:line-clamp-3">
              {blurb}…
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-5">
            {title.average_score != null && (
              <ScoreChip percent={title.average_score} size="lg" />
            )}
            <Link
              href={`/title/${title.id}`}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              Open
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="py-4 sm:py-8">
      <h1 className="max-w-3xl text-[clamp(2.25rem,1.4rem+3.6vw,4.25rem)] leading-[0.96] font-bold tracking-[-0.04em] text-balance-pretty">
        Rank what you watch.
      </h1>
      <p className="text-fg-2 mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
        Stack doesn&rsquo;t ask you to invent a number. Say whether you liked
        something, answer a few &ldquo;which was better&rdquo; questions, and it
        works out where it sits against everything else you&rsquo;ve seen.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          Create an account
        </Link>
        <Link href="/discover" className={buttonVariants({ size: "lg" })}>
          Browse the catalog
        </Link>
      </div>
    </section>
  );
}

function EmptyCatalog() {
  return (
    <GlassPanel radius="xl" className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-xl font-bold tracking-tight">The catalog is empty</h1>
      <p className="text-fg-2 mt-3 text-sm leading-relaxed">
        Supabase is connected, but no titles have been synced yet.
      </p>
      <pre className="glass-subtle mt-4 overflow-x-auto rounded-md px-4 py-3 text-left font-mono text-xs">
        npm run sync:seed
      </pre>
    </GlassPanel>
  );
}
