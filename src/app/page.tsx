import Link from "next/link";

import { AiringToday, type AiringItem } from "@/components/home/airing-today";
import { ContinueWatching } from "@/components/home/continue-watching";
import { MoodTiles } from "@/components/home/mood-tiles";
import { Spotlight, type SpotlightSlide } from "@/components/home/spotlight";
import { TitleRow } from "@/components/title/title-row";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getAiringToday,
  getContinueWatching,
  getRatingsMap,
  getRecommendations,
  getShelf,
  getSpotlight,
  getThisSeason,
  getTrackedTitleIds,
  type SpotlightTitle,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  countdown,
  currentSeason,
  displayTitle,
  formatLabel,
  mediaAccent,
  MEDIA_LABEL,
  stripHtml,
  titleCase,
} from "@/lib/utils";

export default async function HomePage() {
  const user = await getCurrentUser();
  const { season, year } = currentSeason();

  const [
    spotlight,
    thisSeason,
    animePopular,
    animeTop,
    mangaPopular,
    mangaTop,
    lnPopular,
    lnTop,
    { now, rows: airingRows },
    tracked,
    recs,
    ratings,
    continueRows,
  ] = await Promise.all([
    getSpotlight(5),
    getThisSeason(24),
    getShelf("anime", "popular"),
    getShelf("anime", "top_rated"),
    getShelf("manga", "popular"),
    getShelf("manga", "top_rated"),
    getShelf("light_novel", "popular"),
    getShelf("light_novel", "top_rated"),
    getAiringToday(),
    getTrackedTitleIds(),
    user ? getRecommendations(user.id, 12) : Promise.resolve([]),
    user ? getRatingsMap(user.id) : Promise.resolve(new Map<string, number>()),
    user ? getContinueWatching(user.id, 6) : Promise.resolve([]),
  ]);

  const empty =
    spotlight.length === 0 && animePopular.length === 0 && mangaPopular.length === 0;
  if (empty) return <EmptyCatalog />;

  const slides = spotlight.map((title, i) =>
    toSlide(title, i, season, year, now, ratings.get(title.id) ?? null),
  );

  // The spotlight already gave these five a whole screen each; showing them
  // again as the first five posters of the row underneath just looks like the
  // page repeating itself.
  const spotlightIds = new Set(spotlight.map((title) => title.id));
  const seasonRest = thisSeason.filter((title) => !spotlightIds.has(title.id));

  /*
    Today's episodes, ordered the way you'd actually read them: what's still
    coming, soonest first, then what already went out. Sorting by clock time
    alone puts eight greyed-out "aired" cards at the front of the strip for
    anyone opening the app in the evening.
  */
  const airing: AiringItem[] = airingRows
    .map((row) => ({
      id: row.id,
      titleId: row.titles.id,
      name: displayTitle(row.titles),
      cover: row.titles.cover_image_large,
      art: row.titles.cover_color ?? mediaAccent(row.titles.media_type),
      accent: mediaAccent(row.titles.media_type),
      episode: row.episode,
      airingAt: row.airing_at,
      time: new Date(row.airing_at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      tracked: tracked.has(row.titles.id),
    }))
    .sort((a, b) => {
      const at = new Date(a.airingAt).getTime();
      const bt = new Date(b.airingAt).getTime();
      const aPending = at > now;
      const bPending = bt > now;
      if (aPending !== bPending) return aPending ? -1 : 1;
      if (a.tracked !== b.tracked) return a.tracked ? -1 : 1;
      return aPending ? at - bt : bt - at;
    })
    .slice(0, 14);

  /*
    The page has a shape, not just a length: one thing to look at, then the two
    sections that are different every day, then discovery. Inside discovery the
    rows alternate ranked and unranked per media type, so eight shelves don't
    read as one undifferentiated list.
  */
  return (
    <div className="space-y-10 sm:space-y-14">
      {!user && <Pitch />}

      <Spotlight slides={slides} />

      <AiringToday items={airing} now={now} />

      {continueRows.length > 0 && (
        <ContinueWatching rows={continueRows} now={now} />
      )}

      {recs.length > 0 && (
        <TitleRow
          heading="For you"
          eyebrow="Based on what you've rated"
          titles={recs}
          ratings={ratings}
          accent="var(--accent)"
        />
      )}

      {seasonRest.length > 0 && (
        <TitleRow
          heading="Airing now"
          eyebrow={`${titleCase(season)} ${year}`}
          titles={seasonRest}
          ratings={ratings}
          accent={mediaAccent("anime")}
          href={`/discover?media=anime&season=${season}&year_min=${year}&year_max=${year}`}
        />
      )}

      <TitleRow
        heading="Top 10 anime"
        eyebrow="Highest rated in the catalog"
        titles={animeTop.slice(0, 10)}
        ratings={ratings}
        accent={mediaAccent("anime")}
        href="/discover?media=anime&sort=score"
        ranked
        size="lg"
      />

      <TitleRow
        heading="Popular anime"
        titles={animePopular}
        ratings={ratings}
        accent={mediaAccent("anime")}
        href="/discover?media=anime&sort=popularity"
      />

      {!user && <HowItWorks />}

      <TitleRow
        heading={`Top 10 ${MEDIA_LABEL.manga.toLowerCase()}`}
        eyebrow="Highest rated in the catalog"
        titles={mangaTop.slice(0, 10)}
        ratings={ratings}
        accent={mediaAccent("manga")}
        href="/discover?media=manga&sort=score"
        ranked
        size="lg"
      />

      <TitleRow
        heading={`Popular ${MEDIA_LABEL.manga.toLowerCase()}`}
        titles={mangaPopular}
        ratings={ratings}
        accent={mediaAccent("manga")}
        href="/discover?media=manga&sort=popularity"
      />

      <TitleRow
        heading={`Top 10 ${MEDIA_LABEL.light_novel.toLowerCase()}`}
        eyebrow="Highest rated in the catalog"
        titles={lnTop.slice(0, 10)}
        ratings={ratings}
        accent={mediaAccent("light_novel")}
        href="/discover?media=light_novel&sort=score"
        ranked
        size="lg"
      />

      <TitleRow
        heading={`Popular ${MEDIA_LABEL.light_novel.toLowerCase()}`}
        titles={lnPopular}
        ratings={ratings}
        accent={mediaAccent("light_novel")}
        href="/discover?media=light_novel&sort=popularity"
      />

      <MoodTiles />
    </div>
  );
}

/** Catalog row → what the spotlight needs, all formatting done server-side. */
function toSlide(
  title: SpotlightTitle,
  i: number,
  season: string,
  year: number,
  now: number,
  score: number | null,
): SpotlightSlide {
  const accent = mediaAccent(title.media_type);
  const nextAt = title.next_airing_at ? new Date(title.next_airing_at) : null;

  const meta = [
    formatLabel(title.format),
    title.episodes ? `${title.episodes} episodes` : null,
    title.studios?.[0] ?? null,
  ].filter((bit): bit is string => Boolean(bit));

  const blurb = stripHtml(title.synopsis ?? "").slice(0, 200);

  return {
    id: title.id,
    name: displayTitle(title),
    art: title.cover_color ?? accent,
    accent,
    cover: title.cover_image_large,
    banner: title.banner_image,
    blurb: blurb ? `${blurb}…` : "",
    score,
    percent: title.average_score,
    meta,
    genres: title.genres?.slice(0, 3) ?? [],
    eyebrow:
      title.season_year === year
        ? `${titleCase(season)} ${year} · #${i + 1} most tracked`
        : `#${i + 1} most tracked`,
    airing:
      nextAt && title.next_airing_ep != null && nextAt.getTime() > now
        ? `Episode ${title.next_airing_ep} in ${countdown(nextAt, now)}`
        : null,
  };
}

/**
 * The signed-out opener. It has one job — say what this is in the six words
 * someone reads before deciding to scroll — so it stays above the spotlight and
 * stays short. The argument for the product is made further down, once the
 * artwork has done its work.
 */
function Pitch() {
  return (
    <section className="pt-2 pb-1 sm:pt-6">
      <p className="axis-caps text-fg-3 mb-4">
        Anime · Manga · Light novels
      </p>
      <h1 className="max-w-3xl text-[clamp(2.25rem,1.4rem+3.6vw,4.25rem)] leading-[0.96] font-bold tracking-[-0.04em] text-balance">
        Rank what you watch.{" "}
        <span
          style={{
            background:
              "linear-gradient(96deg, var(--color-anime), var(--color-manga) 55%, var(--color-ln))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Properly.
        </span>
      </h1>
      <p className="text-fg-2 mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
        Stack doesn&rsquo;t ask you to invent a number. Say whether you liked
        something, answer a few &ldquo;which was better&rdquo; questions, and it
        works out where it sits against everything else you&rsquo;ve seen.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
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

/**
 * Three steps, placed where a visitor has just scrolled past a hundred posters
 * and is deciding whether this is worth an account.
 */
function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Say if you liked it",
      body: "Loved it, it was fine, or you didn't. Three buttons, no numbers.",
      tint: "var(--color-anime)",
    },
    {
      n: "2",
      title: "Answer a few duels",
      body: "“Which was better?” About five taps places a title among thirty.",
      tint: "var(--color-manga)",
    },
    {
      n: "3",
      title: "Get a real ranking",
      body: "Your list is ordered by your own answers — and it re-sorts as it grows.",
      tint: "var(--color-ln)",
    },
  ];

  return (
    <GlassPanel radius="xl" className="p-5 sm:p-8">
      <h2 className="text-lg font-bold tracking-[-0.02em] sm:text-xl">
        A score you&rsquo;ll actually stand behind
      </h2>
      <p className="text-fg-3 mt-2 max-w-2xl text-sm leading-relaxed">
        Nobody can tell a 7.4 from a 7.8 twice in a row. Everybody can tell you
        which of two shows they preferred.
      </p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.n}
            className="glass-subtle specular rounded-md p-4"
            style={{
              borderColor: `color-mix(in oklch, ${step.tint} 22%, transparent)`,
            }}
          >
            <span
              className="numeral grid size-7 place-items-center rounded-full text-[13px]"
              style={{
                background: `color-mix(in oklch, ${step.tint} 22%, transparent)`,
                color: step.tint,
              }}
              aria-hidden
            >
              {step.n}
            </span>
            <p className="mt-3 text-sm font-semibold tracking-tight">{step.title}</p>
            <p className="text-fg-3 mt-1.5 text-[13px] leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>
    </GlassPanel>
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
