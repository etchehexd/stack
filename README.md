# Stack

An anime, manga and light novel tracker built around **comparative rating**:
instead of asking you to invent a number, it asks which of two shows you liked
more and works the score out from where things land against each other.

Letterboxd's profile and list culture, AniList's database and calendar, an
iOS-style liquid-glass interface.

---

## Start here

**→ [`MANUAL_SETUP.md`](./MANUAL_SETUP.md)** — the Supabase steps, env vars and
first sync. About 20 minutes.

**→ [`DECISIONS.md`](./DECISIONS.md)** — every product call made on your behalf,
and the one file to edit to change each one.

Short version:

```bash
# 1. create a Supabase project, run supabase/schema.sql in its SQL editor
# 2. cp .env.example .env.local  and fill in the three Supabase values
npm install
npm run sync:seed   # pulls ~2,500 titles from AniList (3–5 min)
npm run dev
```

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Styling | Tailwind CSS v4, design tokens in `globals.css` |
| Animation | Motion (Framer Motion) |
| Backend | Supabase — Postgres, Auth, RLS |
| Search | Postgres `pg_trgm` trigram similarity (no separate search service) |
| Catalog | AniList GraphQL API |
| Hosting | Vercel + Supabase, both free tier |

## Layout

```
supabase/schema.sql          Full schema: tables, RLS, indexes, RPCs. Run this first.
scripts/sync-anilist.ts      AniList → Supabase catalog sync (npm run sync:*)

src/
  proxy.ts                   Auth token refresh (Next 16's renamed middleware)
  app/
    page.tsx                 Home — full-width lead title + per-media shelves
    discover/                Fuzzy search + tri-state filters
    library/                 Three media tabs, status, tap-+1 progress
    calendar/                7-day airing schedule, library-highlighted
    title/[id]/              Detail: art hero, action bar, stats, franchise
    u/[username]/            Profile: bucket bar, ranked list, stats, activity
    settings/                Profile fields and privacy
    (auth)/                  Sign in / sign up
    actions/                 Server actions: rating.ts, library.ts
    api/cron/sync/           Scheduled catalog refresh (Vercel Cron)
  components/
    rating/                  RateButton, RatingDialog, ScoreChip
    library/                 ProgressStepper, VolumeField, StatusPicker
    title/                   TitleCard, TitleRow
    ui/                      Glass primitives, Popover (all menus portal), TriStateChip
    shell/                   Nav, tab bar, quick search, theme toggle
  lib/
    rating.ts                Buckets, the 0-10 scale, binary-search placement
    queries.ts               Every server-side read
    anilist.ts               GraphQL client + mappers
    supabase/                client / server / admin
```

## The rating model

You never type a score. You say roughly how you felt, answer a few head-to-head
questions, and the number comes out of where the title landed.

1. Pick a bucket — **Loved it**, **It was fine**, **Didn't like it**.
2. Stack binary-searches that bucket — "which did you prefer?", one pair at a
   time. About log2(n) questions, so five taps place a title among thirty.
3. Everything in the bucket is respread across its slice of the 0-10 scale:

   | Bucket | Range |
   | --- | --- |
   | Didn't like it | 0.1 – 3.3 |
   | It was fine | 3.4 – 6.7 |
   | Loved it | 6.8 – 10.0 |

Your scores move as the list grows, and that is the point — a 9.1 means
"ninth-best thing I've seen", which is a fact about the list, not the title.

Your first ten ratings are typed in directly, because there is nothing to
compare against yet; the first comparison in a bucket takes those seeds
relative too.

The server owns all of it — `place_rating()`, `seed_rating()` and
`respread_bucket()` in `supabase/schema.sql`. `src/lib/rating.ts` holds the
matching constants and the binary-search driver.

> **Changing the rating model needs a schema run.** `supabase/schema.sql`
> migrates the old two-axis `ratings` table in place (old scores are carried
> over as the mean of the two axes, doubled). Paste it into the Supabase SQL
> editor before deploying, or every score on the site reads as `—`.

## Commands

```bash
npm run dev             # dev server
npm run build           # production build (typechecks too)
npm run typecheck       # tsc --noEmit
npm run lint            # eslint

npm run sync:seed       # first run — bulk catalog pull
npm run sync:refresh    # current season + airing schedule
npm run sync:airing     # airing schedule only (cheap; good daily cron)
npm run sync:relations  # backfill franchise links
```

## Deploying

Repo: <https://github.com/etchehexd/stack> (private, default branch `main`).
The Next.js app is at the repository root, so Vercel needs no root-directory
configuration.

Once Vercel is connected (see [`MANUAL_SETUP.md`](./MANUAL_SETUP.md) §7), every
push to `main` deploys to production and every PR gets a preview URL:

```bash
git add -A
git commit -m "your message"
git push
```

Two things that are **not** part of a deploy:

- **Schema changes.** `supabase/schema.sql` is run by hand in the Supabase SQL
  editor. It's written to be safely re-runnable.
- **The full catalog sync.** `npm run sync:seed` runs from your machine and
  writes straight to Supabase. Vercel's daily cron only does the light refresh.

## Notes

- Title data comes from [AniList](https://anilist.co). This project isn't
  affiliated with them. Their API is free and needs no key; the sync script
  self-throttles to stay inside the rate limit.
- Catalog tables are readable by everyone and writable only by the service-role
  key. User data is owner-writable and publicly readable unless the row or the
  profile is marked private. See §15 of `supabase/schema.sql`.
