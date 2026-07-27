import Link from "next/link";
import {
  Coffee,
  Compass,
  Ghost,
  Heart,
  Laugh,
  Rocket,
  Sparkles,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * A way out of the page that isn't another shelf.
 *
 * Eight shelves deep, the honest question is "what am I in the mood for", and
 * the answer lives on Discover behind a genre filter nobody scrolls down to
 * find. These are that filter, pre-pressed.
 *
 * The colours are the app's own accent tokens, not eight invented hues: a
 * genre keeps the same colour wherever it appears, and the palette stays the
 * one the rest of the app is built from.
 */
const MOODS: { label: string; genre: string; icon: LucideIcon; tint: string }[] = [
  { label: "Action", genre: "Action", icon: Swords, tint: "var(--color-anime)" },
  { label: "Romance", genre: "Romance", icon: Heart, tint: "var(--color-manga)" },
  { label: "Comedy", genre: "Comedy", icon: Laugh, tint: "var(--color-enjoyment)" },
  { label: "Fantasy", genre: "Fantasy", icon: Sparkles, tint: "var(--color-ln)" },
  { label: "Sci-Fi", genre: "Sci-Fi", icon: Rocket, tint: "var(--color-craft)" },
  { label: "Slice of Life", genre: "Slice of Life", icon: Coffee, tint: "var(--success)" },
  { label: "Adventure", genre: "Adventure", icon: Compass, tint: "var(--color-anime)" },
  { label: "Sports", genre: "Sports", icon: Trophy, tint: "var(--color-enjoyment)" },
  { label: "Mystery", genre: "Mystery", icon: Ghost, tint: "var(--color-craft)" },
  { label: "Drama", genre: "Drama", icon: Heart, tint: "var(--color-manga)" },
];

export function MoodTiles() {
  return (
    <section aria-labelledby="mood-heading" className="min-w-0">
      <header className="mb-3.5 flex items-center gap-3">
        <span
          className="h-7 w-[3px] shrink-0 rounded-pill sm:h-8"
          style={{ background: "var(--glass-border-strong)" }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="axis-caps text-fg-3 mb-0.5">Not sure what you want</p>
          <h2
            id="mood-heading"
            className="truncate text-lg font-bold tracking-[-0.02em] sm:text-xl"
          >
            Browse by mood
          </h2>
        </div>
      </header>

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {MOODS.map(({ label, genre, icon: Icon, tint }) => (
          <li key={label}>
            <Link
              href={`/discover?genres=${encodeURIComponent(genre)}&sort=popularity`}
              className="glass-subtle specular glass-press group/mood flex items-center gap-2.5 rounded-md px-3 py-3 transition-[border-color,transform] duration-300"
              style={{
                borderColor: `color-mix(in oklch, ${tint} 26%, transparent)`,
                background: `linear-gradient(140deg, color-mix(in oklch, ${tint} 15%, transparent) 0%, var(--glass-1) 58%)`,
              }}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover/mood:scale-110"
                style={{
                  background: `color-mix(in oklch, ${tint} 20%, transparent)`,
                  color: tint,
                }}
              >
                <Icon className="size-4" strokeWidth={2.25} />
              </span>
              <span className="truncate text-[13px] font-semibold tracking-tight">
                {label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
