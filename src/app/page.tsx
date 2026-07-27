import Link from "next/link";
import { Sparkles } from "lucide-react";

import { TitleShelf } from "@/components/title/title-shelf";
import { TitleCard } from "@/components/title/title-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { buttonVariants } from "@/components/ui/button-variants";
import { getRecommendations, getShelf, getThisSeason } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";
import { AXIS_META } from "@/lib/rating";
import { currentSeason, mediaAccent, MEDIA_LABEL, titleCase } from "@/lib/utils";

export default async function HomePage() {
  // The "Supabase not configured" case is handled once, in the root layout —
  // if we get here credentials exist, so an empty result really does mean an
  // empty catalog.
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
  ] = await Promise.all([
    getThisSeason(18),
    getShelf("anime", "popular"),
    getShelf("anime", "top_rated"),
    getShelf("manga", "popular"),
    getShelf("manga", "top_rated"),
    getShelf("light_novel", "popular"),
    getShelf("light_novel", "top_rated"),
    user ? getRecommendations(user.id, 12) : Promise.resolve([]),
  ]);

  const empty =
    thisSeason.length === 0 && animePopular.length === 0 && mangaPopular.length === 0;

  if (empty) return <EmptyCatalog />;

  return (
    <div className="space-y-12">
      {!user && <Hero />}

      {thisSeason.length > 0 && (
        <section>
          <header className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">This Season</h2>
              <p className="text-fg-3 text-sm">
                {titleCase(season)} {year} · airing now
              </p>
            </div>
            <Link
              href={`/discover?media=anime&season=${season}&year_min=${year}&year_max=${year}`}
              className="text-fg-3 hover:text-fg text-xs font-medium transition-colors"
            >
              See all
            </Link>
          </header>

          {/*
            Bento grid rather than another uniform carousel: the season's most
            popular title takes a 2×2 feature slot and the rest fill around it.
          */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {thisSeason.slice(0, 13).map((title, i) => (
              <TitleCard
                key={title.id}
                title={title}
                priority={i < 4}
                className={i === 0 ? "col-span-2 row-span-2" : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {recs.length > 0 && (
        <section>
          <header className="mb-3 flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-[var(--accent)]" />
            <h2 className="text-base font-semibold tracking-tight">For you</h2>
            <span className="text-fg-3 text-xs">
              clustered near your high-enjoyment, high-craft ratings
            </span>
          </header>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {recs.map((r) => (
              <TitleCard
                key={r.id}
                title={r}
                className="w-[42vw] shrink-0 sm:w-40 lg:w-44"
              />
            ))}
          </div>
        </section>
      )}

      <MediaSection type="anime" popular={animePopular} topRated={animeTop} />
      <MediaSection type="manga" popular={mangaPopular} topRated={mangaTop} />
      <MediaSection type="light_novel" popular={lnPopular} topRated={lnTop} />
    </div>
  );
}

function MediaSection({
  type,
  popular,
  topRated,
}: {
  type: "anime" | "manga" | "light_novel";
  popular: Awaited<ReturnType<typeof getShelf>>;
  topRated: Awaited<ReturnType<typeof getShelf>>;
}) {
  if (popular.length === 0 && topRated.length === 0) return null;
  const accent = mediaAccent(type);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="h-6 w-1 rounded-pill" style={{ background: accent }} />
        <h2 className="text-xl font-semibold tracking-tight">{MEDIA_LABEL[type]}</h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <TitleShelf
          heading="Most popular"
          titles={popular}
          accent={accent}
          href={`/discover?media=${type}&sort=popularity`}
        />
        <TitleShelf
          heading="Highest rated"
          titles={topRated}
          accent={accent}
          href={`/discover?media=${type}&sort=score`}
        />
      </div>
    </section>
  );
}

function Hero() {
  return (
    <GlassPanel radius="2xl" className="overflow-hidden p-8 sm:p-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance-pretty sm:text-5xl">
          You shouldn&rsquo;t have to pick one number.
        </h1>
        <p className="text-fg-2 mt-4 text-base leading-relaxed text-balance-pretty sm:text-lg">
          Rate every anime, manga and light novel twice: how much you{" "}
          <span style={{ color: AXIS_META.enjoyment.color }} className="font-medium">
            enjoyed
          </span>{" "}
          it, and how well{" "}
          <span style={{ color: AXIS_META.craft.color }} className="font-medium">
            made
          </span>{" "}
          it is. Love a mess. Respect a masterpiece you bounced off. Both are true.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Start your Stack
          </Link>
          <Link href="/discover" className={buttonVariants({ size: "lg" })}>
            Browse the catalog
          </Link>
        </div>
      </div>
    </GlassPanel>
  );
}

function EmptyCatalog() {
  return (
    <GlassPanel radius="xl" className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-xl font-semibold">The catalog is empty</h1>
      <p className="text-fg-2 mt-3 text-sm leading-relaxed">
        Supabase is connected, but no titles have been synced yet.
      </p>
      <pre className="glass-subtle mt-4 overflow-x-auto rounded-md px-4 py-3 text-left font-mono text-xs">
        npm run sync:seed
      </pre>
      <p className="text-fg-3 mt-4 text-xs leading-relaxed">
        Takes 3–5 minutes. If it errors, run{" "}
        <code className="font-mono">npm run doctor</code> — it will tell you exactly
        which step is incomplete.
      </p>
    </GlassPanel>
  );
}
