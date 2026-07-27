import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TitleShelf } from "@/components/title/title-shelf";
import { TitleCard } from "@/components/title/title-card";
import { Score } from "@/components/rating/score";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getRatingsMap,
  getRecommendations,
  getShelf,
  getThisSeason,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { AXIS_META } from "@/lib/rating";
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
    user ? getRatingsMap(user.id) : Promise.resolve(new Map()),
  ]);

  const empty =
    thisSeason.length === 0 && animePopular.length === 0 && mangaPopular.length === 0;

  if (empty) return <EmptyCatalog />;

  const [lead, ...rest] = thisSeason;

  return (
    <div className="space-y-14">
      {!user && <Hero />}

      {/* ===== Feature ====================================================== */}
      {lead && <Feature title={lead} season={season} year={year} />}

      {/* ===== The rest of the season ======================================= */}
      {rest.length > 0 && (
        <Section
          heading="Also this season"
          href={`/discover?media=anime&season=${season}&year_min=${year}&year_max=${year}`}
        >
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {rest.slice(0, 8).map((title, i) => (
              <TitleCard
                key={title.id}
                title={title}
                rating={ratings.get(title.id) ?? null}
                priority={i < 4}
              />
            ))}
          </div>
        </Section>
      )}

      {recs.length > 0 && (
        <Section heading="For you">
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {recs.map((r) => (
              <TitleCard
                key={r.id}
                title={r}
                rating={ratings.get(r.id) ?? null}
                className="w-[40vw] shrink-0 sm:w-40 lg:w-44"
              />
            ))}
          </div>
        </Section>
      )}

      <MediaSection
        type="anime"
        popular={animePopular}
        topRated={animeTop}
        ratings={ratings}
      />
      <MediaSection
        type="manga"
        popular={mangaPopular}
        topRated={mangaTop}
        ratings={ratings}
      />
      <MediaSection
        type="light_novel"
        popular={lnPopular}
        topRated={lnTop}
        ratings={ratings}
      />
    </div>
  );
}

/**
 * One title, full width, at poster-and-synopsis scale.
 *
 * The old home page opened with thirteen equally-weighted thumbnails, which
 * gave the eye nowhere to land. A single lead running the width of the page
 * sets a scale for everything under it — and because the panel is tinted with
 * that title's own cover colour, the top of the page looks different every
 * season instead of looking like a template.
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
  const blurb = stripHtml(title.synopsis ?? "").slice(0, 240);

  return (
    <section
      className="art-edge relative overflow-hidden rounded-2xl"
      style={{ "--art": art, background: "var(--glass-2)" } as React.CSSProperties}
    >
      {title.cover_image_large && (
        <Image
          src={title.cover_image_large}
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-110 object-cover opacity-25 blur-2xl"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(100deg, color-mix(in oklch, ${art} 42%, transparent), transparent 70%)`,
        }}
        aria-hidden
      />

      <div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
        <Link
          href={`/title/${title.id}`}
          className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl shadow-[var(--shadow-lift)] sm:w-44"
          style={{ background: art, border: "1px solid oklch(1 0 0 / 0.14)" }}
        >
          {title.cover_image_large && (
            <Image
              src={title.cover_image_large}
              alt=""
              fill
              priority
              sizes="176px"
              className="object-cover"
            />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <p className="axis-caps text-fg-3 mb-2.5">
            <span style={{ color: accent }}>
              {titleCase(season)} {year}
            </span>
            <span className="mx-2 opacity-35">·</span>
            Most tracked
          </p>

          <h2 className="page-title text-balance-pretty">
            <Link
              href={`/title/${title.id}`}
              className="transition-opacity hover:opacity-80"
            >
              {name}
            </Link>
          </h2>

          {blurb && (
            <p className="text-fg-2 mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed">
              {blurb}…
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-5">
            {title.average_score != null && (
              <Score percent={title.average_score} size="md" className="!p-0" />
            )}
            <Link
              href={`/title/${title.id}`}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              Open
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Section({
  heading,
  href,
  children,
}: {
  heading: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">{heading}</h2>
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
      {children}
    </section>
  );
}

function MediaSection({
  type,
  popular,
  topRated,
  ratings,
}: {
  type: "anime" | "manga" | "light_novel";
  popular: Awaited<ReturnType<typeof getShelf>>;
  topRated: Awaited<ReturnType<typeof getShelf>>;
  ratings: Awaited<ReturnType<typeof getRatingsMap>>;
}) {
  if (popular.length === 0 && topRated.length === 0) return null;
  const accent = mediaAccent(type);

  return (
    <section className="space-y-7">
      <div className="border-hairline flex items-center gap-3 border-b pb-3">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: accent, boxShadow: `0 0 14px ${accent}` }}
        />
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">
          {MEDIA_LABEL[type]}
        </h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <TitleShelf
          heading="Most popular"
          titles={popular}
          accent={accent}
          ratings={ratings}
          href={`/discover?media=${type}&sort=popularity`}
        />
        <TitleShelf
          heading="Highest rated"
          titles={topRated}
          accent={accent}
          ratings={ratings}
          href={`/discover?media=${type}&sort=score`}
        />
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="py-6 sm:py-10">
      <h1 className="max-w-4xl text-[clamp(2.25rem,1.5rem+3.4vw,4.5rem)] leading-[0.98] font-bold tracking-[-0.04em] text-balance-pretty">
        Two scores.
        <br />
        <span style={{ color: AXIS_META.enjoyment.color }}>Enjoyment</span> and{" "}
        <span style={{ color: AXIS_META.craft.color }}>craft</span>, kept apart.
      </h1>
      <p className="text-fg-2 mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
        Track anime, manga and light novels. Rate how much you liked something
        and how well it was made as separate numbers, because they usually are.
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
