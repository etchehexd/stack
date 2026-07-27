# Stack

An anime, manga and light novel tracker built around a **two-axis rating
system**: every title gets a separate **Enjoyment** score and **Craft** score,
so you never have to choose between overrating a mess you love and underrating
a masterpiece you bounced off.

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
    page.tsx                 Home — bento season grid + per-media shelves
    discover/                Fuzzy search + tri-state filters
    library/                 Three media tabs, status, tap-+1 progress
    calendar/                7-day airing schedule, library-highlighted
    title/[id]/              Detail, rating pad, franchise, community scatter
    u/[username]/            Profile, stats, full Enjoyment × Craft scatter
    settings/                Profile + the opt-in "Overall" sort
    (auth)/                  Sign in / sign up
    actions/                 Server actions: rating.ts, library.ts
    api/cron/sync/           Scheduled catalog refresh (Vercel Cron)
  components/
    rating/                  StarRow, RatingPad, RatingScatter, RatingBadge
    library/                 ProgressStepper, VolumeField, StatusPicker
    title/                   TitleCard, TitleShelf
    ui/                      Glass primitives incl. TriStateChip
    shell/                   Nav, tab bar, quick search, theme toggle
  lib/
    rating.ts                Two-axis logic, quadrants, isolated composite score
    queries.ts               Every server-side read
    anilist.ts               GraphQL client + mappers
    supabase/                client / server / admin
```

## The rating model

Two independent scores, `0.5–5.0` in half-star steps:

- **Enjoyment** — how much you personally liked it
- **Craft** — how well-made it is

They're stored separately, displayed side by side everywhere, and **never
blended** in the UI. The only place they combine is an opt-in "Overall" sort
(even 50/50 average), isolated in `src/lib/rating.ts` so it can be reweighted or
deleted in one edit.

Every rated title becomes a point on the Enjoyment × Craft plane. The same
`RatingScatter` component renders both the compact live readout beside the star
rows and the full chart on your profile, so the four quadrants read identically
everywhere:

|  | Low craft | High craft |
| --- | --- | --- |
| **High enjoyment** | Guilty pleasures | All-time favorites |
| **Low enjoyment** | Not for you | Respected, not for me |

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

## Notes

- Title data comes from [AniList](https://anilist.co). This project isn't
  affiliated with them. Their API is free and needs no key; the sync script
  self-throttles to stay inside the rate limit.
- Catalog tables are readable by everyone and writable only by the service-role
  key. User data is owner-writable and publicly readable unless the row or the
  profile is marked private. See §15 of `supabase/schema.sql`.
