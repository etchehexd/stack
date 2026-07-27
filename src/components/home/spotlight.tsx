"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

import { ScoreChip } from "@/components/rating/score-chip";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export interface SpotlightSlide {
  id: string;
  name: string;
  /** The title's sampled cover colour — everything on the slide is tinted with it. */
  art: string;
  accent: string;
  cover: string | null;
  banner: string | null;
  blurb: string;
  /** The viewer's own score, if they've rated it. */
  score: number | null;
  /** The catalog average, 0–100. */
  percent: number | null;
  meta: string[];
  genres: string[];
  eyebrow: string;
  /** "Episode 7 · in 2d 4h", precomputed server-side. */
  airing: string | null;
}

const DWELL_MS = 8000;

/* The hero sits on artwork in both themes, so its text can't use the semantic
   foreground tokens — those flip to near-black in light mode and vanish. */
const INK = "oklch(1 0 0 / 0.98)";
const INK_2 = "oklch(1 0 0 / 0.74)";
const INK_3 = "oklch(1 0 0 / 0.56)";

/**
 * The top of the home page: one title, full width, cinematic.
 *
 * A page that is nothing but shelves has no entry point — the eye slides off
 * the top and starts scrolling without ever landing. This gives it one thing
 * that isn't a poster, tinted with that title's own cover colour so the top of
 * the page looks different every season instead of looking like a template with
 * the pictures swapped.
 *
 * It rotates because a home page you're meant to open daily should not be
 * identical at 9am and 9pm. Rotation stops on hover, on focus, and entirely for
 * anyone who has asked for reduced motion — at which point the dots are still
 * there to drive it by hand.
 */
/** The OS "reduce motion" switch, read as a subscription rather than in state. */
function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function Spotlight({ slides }: { slides: SpotlightSlide[] }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const still = usePrefersReducedMotion();

  /*
    Slides mount the first time they're shown and stay mounted after that.
    All five are technically "in the viewport" even at zero opacity, so
    rendering them up front means the browser pulls five full-width banners
    before the first poster below the fold — for four images nobody may look at.
  */
  const [seen, setSeen] = React.useState<number[]>([0]);

  const go = React.useCallback((next: number) => {
    setIndex(next);
    setSeen((prev) => (prev.includes(next) ? prev : [...prev, next]));
  }, []);

  const count = slides.length;
  const rotating = count > 1 && !paused && !still;

  React.useEffect(() => {
    if (!rotating) return;
    const timer = setTimeout(() => go((index + 1) % count), DWELL_MS);
    return () => clearTimeout(timer);
  }, [index, rotating, count, go]);

  if (count === 0) return null;

  return (
    <section
      aria-label="Spotlight"
      aria-roledescription="carousel"
      className="relative isolate h-[26rem] overflow-hidden rounded-2xl sm:h-[23rem] lg:h-[25rem]"
      style={{ background: "var(--bg-base)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {slides.map((slide, i) =>
        seen.includes(i) ? (
          <Slide key={slide.id} slide={slide} active={i === index} first={i === 0} />
        ) : null,
      )}

      {count > 1 && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 sm:top-5 sm:right-5">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${slide.name}`}
              aria-current={i === index}
              className="group/dot h-4 cursor-pointer px-0 py-1.5 transition-[width] duration-500 [transition-timing-function:var(--ease-glass)]"
              style={{ width: i === index ? "2.25rem" : "1rem" }}
            >
              <span
                className="block h-1 w-full overflow-hidden rounded-pill"
                style={{ background: "oklch(1 0 0 / 0.28)" }}
              >
                {i === index && (
                  <span
                    key={`${index}-${rotating}`}
                    className="block h-full origin-left rounded-pill"
                    style={{
                      background: INK,
                      transform: rotating ? undefined : "scaleX(1)",
                      animation: rotating
                        ? `slide-fill ${DWELL_MS}ms linear forwards`
                        : undefined,
                    }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Slide({
  slide,
  active,
  first,
}: {
  slide: SpotlightSlide;
  active: boolean;
  first: boolean;
}) {
  const backdrop = slide.banner ?? slide.cover;

  return (
    <div
      className={cn(
        "absolute inset-0 transition-opacity duration-[900ms] [transition-timing-function:var(--ease-glass)]",
        active ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      style={{ "--art": slide.art } as React.CSSProperties}
      aria-hidden={!active}
      inert={!active}
    >
      {backdrop && (
        <Image
          src={backdrop}
          alt=""
          fill
          priority={first}
          sizes="100vw"
          className={cn(
            "object-cover object-[50%_28%] transition-transform duration-[9s] ease-linear",
            active ? "scale-105" : "scale-100",
            !slide.banner && "scale-125 blur-2xl",
          )}
        />
      )}

      {/* Two washes: the artwork's own colour from the left, then a neutral
          ramp so the text has a guaranteed floor to sit on whatever the art
          does. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(85% 130% at 6% 55%, color-mix(in oklch, var(--art) 60%, transparent) 0%, transparent 68%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, oklch(0.09 0.02 265 / 0.95) 0%, oklch(0.09 0.02 265 / 0.86) 38%, oklch(0.09 0.02 265 / 0.35) 72%, oklch(0.09 0.02 265 / 0.15) 100%), linear-gradient(to top, oklch(0.09 0.02 265 / 0.75) 0%, transparent 55%)",
        }}
        aria-hidden
      />

      <div className="relative flex h-full items-center gap-7 p-5 sm:p-8 lg:gap-10 lg:p-10">
        <Link
          href={`/title/${slide.id}`}
          tabIndex={-1}
          aria-hidden
          className="relative hidden aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-xl shadow-[var(--shadow-lift)] transition-transform duration-500 [transition-timing-function:var(--ease-glass)] hover:-translate-y-1 sm:block lg:w-40"
          style={{
            background: slide.art,
            border: "1px solid oklch(1 0 0 / 0.18)",
          }}
        >
          {slide.cover && (
            <Image
              src={slide.cover}
              alt=""
              fill
              priority={first}
              sizes="160px"
              className="object-cover"
            />
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Right padding on small screens keeps the eyebrow clear of the
              slide dots, which are pinned to the same corner of the hero. */}
          <p className="axis-caps mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 pr-24 sm:pr-0">
            <span style={{ color: slide.accent }}>{slide.eyebrow}</span>
            {slide.airing && (
              <>
                <span style={{ color: INK_3 }} aria-hidden>
                  ·
                </span>
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{ color: INK_2 }}
                >
                  <span
                    className="size-1.5 animate-pulse rounded-full"
                    style={{ background: "var(--success)" }}
                    aria-hidden
                  />
                  {slide.airing}
                </span>
              </>
            )}
          </p>

          <h2 className="page-title line-clamp-2 text-balance" style={{ color: INK }}>
            <Link
              href={`/title/${slide.id}`}
              className="transition-opacity hover:opacity-80"
            >
              {slide.name}
            </Link>
          </h2>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            {(slide.score != null || slide.percent != null) && (
              <ScoreChip
                score={slide.score}
                percent={slide.percent}
                mine={slide.score != null}
                size="md"
              />
            )}
            <p
              className="flex flex-wrap items-center gap-x-2 text-xs font-semibold sm:text-[13px]"
              style={{ color: INK_2 }}
            >
              {slide.meta.map((bit, i) => (
                <React.Fragment key={bit}>
                  {i > 0 && (
                    <span style={{ color: INK_3 }} aria-hidden>
                      ·
                    </span>
                  )}
                  <span>{bit}</span>
                </React.Fragment>
              ))}
            </p>
            <div className="hidden flex-wrap gap-1.5 sm:flex">
              {slide.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-pill px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: "oklch(1 0 0 / 0.13)",
                    color: INK_2,
                    border: "1px solid oklch(1 0 0 / 0.1)",
                  }}
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>

          {slide.blurb && (
            <p
              className="mt-3.5 line-clamp-2 max-w-2xl text-sm leading-relaxed"
              style={{ color: INK_2 }}
            >
              {slide.blurb}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link
              href={`/title/${slide.id}`}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              <Play className="size-4 fill-current" />
              Open
            </Link>
            <Link
              href="/discover?media=anime&sort=popularity"
              className="group/more inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2.5 text-sm font-semibold transition-colors duration-200"
              style={{ color: INK_2, background: "oklch(1 0 0 / 0.1)" }}
            >
              Browse the season
              <ArrowRight className="size-4 transition-transform duration-300 group-hover/more:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
