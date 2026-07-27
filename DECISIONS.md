# Product decisions made on your behalf

Everything here was a judgement call, not something you specified. Each entry
says where to change it. Nothing in this list is load-bearing — they're all
one-file edits.

## Ratings

| Decision | Where |
| --- | --- |
| **"Overall" averages the two axes evenly (50/50)**, as you specified, and is **off by default** — users opt in under Settings → Ratings. | `src/lib/rating.ts` → `OVERALL_WEIGHT_ENJOYMENT` / `OVERALL_WEIGHT_CRAFT`. Delete `overallScore()` and the `"Overall"` entry in `SORT_OPTIONS` to remove the feature entirely; nothing else imports it. |
| **Re-tapping the value you already have clears the rating** (Letterboxd behaviour). | `StarRow.pick()` in `src/components/rating/star-row.tsx` |
| **The two axes are independent — you can set Craft without Enjoyment.** A row with both cleared is deleted rather than stored empty. | `saveRating()` in `src/app/actions/rating.ts`; enforced by the `ratings_not_empty` constraint |
| **Ratings save automatically after a 600 ms pause.** No submit button. | `RatingPad` debounce in `src/components/rating/rating-pad.tsx` |
| **The quadrant boundary is 3.5**, so exactly 3.5 counts as "high" on that axis. | `QUADRANT_PIVOT` in `src/lib/rating.ts` (also hardcoded in the `user_stats` SQL function — change both) |
| **Unrated titles sort to the bottom**, not as zero. | `LibraryView` sort comparator |
| Keyboard on a focused star row: arrows step ±0.5, Home/End jump to min/max, Backspace clears. | `StarRow.onKeyDown` |

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
| Media accents: anime = periwinkle, manga = rose, light novels = jade. Rating axes: Enjoyment = warm amber, Craft = cool cyan (heart vs. head). | `@theme` block in `globals.css` |
| The **ambient background orbs** are two CSS pseudo-elements on a fixed layer, so the glass has something to refract without a per-page cost. | `.ambient-field` in `globals.css` |

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
  `library_entries` + `ratings` (mapping their 1–100 score onto whichever axis
  you decide — probably Enjoyment, leaving Craft blank).
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
