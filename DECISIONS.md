# Product decisions made on your behalf

Everything here was a judgement call, not something you specified. Each entry
says where to change it. Nothing in this list is load-bearing — they're all
one-file edits.

## Ratings

| Decision | Where |
| --- | --- |
| **You never type a score after the first ten.** Asking someone to choose between 7.4 and 7.8 gets a different answer depending on their mood; asking which of two shows they preferred gets the same answer twice. Only the second question is asked. | `RatingDialog` in `src/components/rating/rating-dialog.tsx` |
| **Three buckets, not five.** Loved / fine / bad. Every extra bucket is a decision the user has to make *before* the easy part starts, and the comparisons recover the resolution anyway. | `BUCKETS` in `src/lib/rating.ts` — bands must match `bucket_band()` in the schema |
| **Bands are 0.1–3.3 / 3.4–6.7 / 6.8–10.0.** A title alone in its bucket sits at the band midpoint, not the top: one rating is not evidence that something is your favourite ever. | `bucket_band()` and `respread_bucket()` in `supabase/schema.sql` |
| **Scores move when you rate other things.** A placement respreads its whole bucket. This is the model working, not a bug — a 9.1 is a statement about the ordering, not about the title. | `respread_bucket()` |
| **Comparisons are capped at 7.** log2 of a large bucket is 8–9 questions, which nobody will sit through. At the cap the midpoint of the remaining range is taken; being two places out in a list of 300 moves the score by under a tenth. | `MAX_COMPARISONS` in `src/lib/rating.ts` |
| **The first 10 ratings are typed in and keep the exact number given.** There is nothing to compare against yet. The first comparison in a bucket takes those seeds relative too. | `seed_rating()`; `SEED_TARGET` in `src/lib/rating.ts` |
| **The binary search runs on the client.** One request to fetch the bucket, one to commit — not a round trip per question. | `getBucketList()` in `src/app/actions/rating.ts` |
| **Placement is a single SECURITY DEFINER RPC** acting on `auth.uid()`, so a caller can never reorder someone else's list and a placement cannot half-apply. | `place_rating()` |
| **Old two-axis ratings were migrated, not dropped** — the mean of enjoyment and craft, doubled, is the same 0–10 figure. | the guarded `do $$` block in §7 of `supabase/schema.sql` |
| **Unrated titles sort to the bottom**, not as zero. | `LibraryView` sort comparator |

## Volume tracking

**Volume progress is always a manual, optional, user-owned field** — exactly as
you asked. AniList's `volumes` count is stored but only ever shown as a hint
("of 12") next to the input; it is never prefilled and never required. The field
is hidden entirely for anime. `library_entries.progress_volumes` is nullable
with no default.

See `VolumeField` in `src/components/library/progress-stepper.tsx`.

## Discover

| Decision | Where |
| --- | --- |
| **Tri-state applies to genres, formats, statuses and studios/authors.** Media type is a plain multi-select — excluding "anime" seemed more confusing than useful with only three options. | `src/app/discover/filters.tsx` |
| **Right-click on a chip clears it**, as a shortcut out of the three-step cycle. | `TriStateChip.onContextMenu` |
| All filter state lives in the **URL**, so filtered views are shareable and the back button works. | `filters.tsx` |
| Sort defaults to **relevance when there's a search query, popularity otherwise**. | `src/app/discover/page.tsx` |
| Free-text search debounces at **350 ms**; the nav quick-search at 220 ms. | same files |
| 40 results per page. | `PAGE_SIZE` in `src/app/discover/page.tsx` |

## Catalog & sync

| Decision | Where |
| --- | --- |
| **Light novels are split out of AniList's `MANGA` type** by `format === "NOVEL"` into their own `media_type`. AniList has no LN type; this is the only way to get three first-class categories. | `toMediaType()` in `src/lib/anilist.ts` |
| **Seed pulls ~2,500 titles** (10 pages popular + 6 pages acclaimed per type). Enough to feel populated, small enough for the free tier. | `SEED_PASSES` in `scripts/sync-anilist.ts` |
| **"Highest rated" shelves require ≥5,000 AniList trackers**, so one-vote 100% scores don't dominate. | `getShelf()` in `src/lib/queries.ts` |
| **"Trending" is a proxy** — recent + popular. AniList's real trending score isn't stable enough between daily syncs to store. | same |
| **Relations are only stored when both ends already exist** in your DB, so a sync can't cascade into fetching all of AniList. `npm run sync:relations` backfills. | `upsertRelations()` in the sync script |
| Titles marked adult are **excluded everywhere**. There's a `preferences.adult_content` flag in the schema but no UI wired to it. | `p_include_adult` in `search_titles` |
| Catalog tables have **no client write policies at all** — only the service-role key can write them. | `supabase/schema.sql` §15 |

## Library

| Decision | Where |
| --- | --- |
| **Hitting the last episode/chapter auto-completes** the title; dropping back below the total returns it to "watching". | `incrementProgress()` in `src/app/actions/library.ts` |
| **Rapid +1 taps are coalesced** into one request after 700 ms, and the number updates optimistically. | `ProgressStepper` |
| **Start and completion dates are stamped automatically but never overwritten** — a rewatch won't erase your original completion date. | `upsertLibraryEntry()` |
| Status labels are **media-aware**: "Watching"/"Rewatching" for anime, "Reading"/"Rereading" for manga and LNs. Same underlying enum value. | `statusLabel()` in `src/lib/utils.ts` |
| Library defaults to the **Anime** tab, sorted by **recently updated**. | `LibraryView` initial state |

## Display & design

| Decision | Where |
| --- | --- |
| **English title preferred**, falling back to romaji then native. | `displayTitle()` in `src/lib/utils.ts` |
| **Dark mode is the default**; light mode is fully supported and the choice persists in `localStorage`. | `THEME_BOOTSTRAP` in `src/app/layout.tsx` |
| **Hand-built glass primitives instead of the shadcn/ui CLI.** shadcn components are opaque-surface-first; retrofitting the blur/specular/depth system onto them meant rewriting most of each one anyway. The primitives in `src/components/ui/` follow the same composition patterns (cva variants, forwardRef, `cn()`), so `npx shadcn add` still works if you want to pull in something specific later. | `src/components/ui/` |
| **Four blur levels, seven radii, one specular treatment.** Enforced by tokens rather than convention. | `src/app/globals.css` |
| Media accents: anime = periwinkle, manga = rose, light novels = jade. Score bands: loved = green, fine = amber, bad = red. | `@theme` block in `globals.css`; `BUCKETS` in `src/lib/rating.ts` |
| **Glass fills are mostly opaque (0.62 / 0.82 / 0.93).** The frosted look comes from blur, saturation and the specular rim — not from transparency. Anything much lower lets scrolling content read through floating panels, which looks broken rather than layered. | `--glass-1/2/3` in `globals.css` |
| **Blur only floats, tint insets.** Only `glass-heavy` (nav, tab bar, menus, popovers) and `glass-scrim` blur. `glass` — the stationary content panels — and `glass-subtle` are tint-only: a panel in the page flow has nothing behind it but the flat backdrop, so the filter was paying full GPU cost per scroll frame to blur one solid colour, and nesting one blur inside another is what produces smeared artifacts. | `@utility glass`, `@utility glass-subtle` |
| **Small-caps labels, not coloured chips.** Used for bucket names, stat-tile labels and the title-page metadata line. A tinted chip beside tinted data puts two blocks of the same hue side by side; a recessive label lets the data keep the colour. | `@utility axis-caps` in `globals.css` |
| **Every score displays as 0–10 with one decimal.** User scores are already on that scale; AniList's 0–100 percentage is tenthed. One conversion function, no mixed units on a card. | `formatScore()` / `formatPercentAsTen()` in `src/lib/rating.ts` |
| **No charts anywhere.** The scatter plot, the community histograms, the profile chart and the plane glyph were all removed. Scores are numerals; the only chart-like thing left is the profile's bucket bar, which is one stacked line. | `src/components/rating/score-chip.tsx` |
| **The score on a poster is a bare numeral with a colour rule** — no pill, no plate, no background. That keeps it to about two characters of the artwork while still being the first thing readable, because it's the only text on the image. | `ScoreChip` in `src/components/rating/score-chip.tsx` |
| **Every menu portals to `<body>`.** `specular` sets `isolation: isolate`, so a z-index inside a panel can only order that panel's own children — which is why dropdowns kept ending up behind other panels and becoming unclickable. There is one z-index scale and one portal. Never re-add an absolutely positioned menu. | `src/components/ui/popover.tsx`; `--z-*` in `globals.css` |
| **The artwork tints its own surroundings.** Cards, the detail hero and the home lead all set `--art` from the title's sampled cover colour and spend it on a bloom, a hairline and a wash. It is the main reason two pages of identical layout do not look identical. | `--art`, `@utility art-glow` / `art-edge` in `globals.css` |
| **The home page is a stack of full-width rows.** Two shelves side by side halved every poster and put two competing scroll directions on one line. | `TitleRow` in `src/components/title/title-row.tsx` |
| **No decorative gradients on large surfaces.** The background is flat with one faint neutral lift; empty profile banners and missing title banners are flat tints. Colour comes from cover art and from the accents, which carry meaning. | `.ambient-field`, profile/title banner fallbacks |
| **Never hand-write vendor prefixes in `globals.css`.** Lightning CSS (via Tailwind v4) adds them from your browser targets. Writing `-webkit-backdrop-filter` alongside the standard property made it keep only the prefixed one — see the note below. | comment above `@utility glass` |

## Deviations from your spec

1. **shadcn/ui CLI not used** — see the table above. Same idioms, custom implementations.
2. **No separate search service.** Postgres `pg_trgm` handles the fuzzy search as
   you hoped. It'll comfortably carry six figures of titles. If you ever exceed
   that, the swap point is `search_titles` in `supabase/schema.sql` plus
   `searchTitles()` in `src/lib/queries.ts` — nothing else touches search.
3. **`middleware.ts` is `proxy.ts`.** Next.js 16 renamed the convention; the
   function must be named `proxy` and runs on the Node runtime.

## Not built

Scoped out of this pass, in rough order of how much is already in place:

- **Reviews** — table, RLS and indexes exist; no UI.
- **Lists** — `lists` / `list_items` tables and policies exist; no UI.
- **Social** — `follows` table and the `taste_compatibility()` RPC are done and
  tested; no follow button or feed page.
- **MAL/AniList import** — nothing yet. The natural shape is a route handler that
  takes an AniList username, queries their `MediaListCollection`, and bulk-upserts
  `library_entries` plus a `seed_rating()` call per scored title (their 0–100
  divided by 10 lands directly on this scale). Import as seeds, not placements —
  the buckets sort themselves out on the first comparison.
- **Yearly Wrapped** — nothing yet; `user_stats()` already computes most of the
  inputs.
- **Episode notifications** — needs a push/email provider.
- **PWA offline reads** — the manifest and install metadata are in place, so it
  installs to a home screen, but there's no service worker, so it isn't usable
  offline yet.
- **Avatar/banner upload** — the columns are read everywhere; no upload UI or
  Storage bucket.

## Verified

- `npm run build` passes clean (TypeScript included).
- All 12 routes render; home, login and discover checked in a browser.
- Every page degrades gracefully when Supabase is unreachable — queries log and
  return empty rather than throwing.
- **Not verified:** anything requiring a live database — sign-up, rating writes,
  search quality, the sync script against the real AniList API. I had no
  Supabase project to point at.
