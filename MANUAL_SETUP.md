# Manual setup — everything only you can do

This is the consolidated checklist. Work top to bottom; it takes about 20
minutes, most of which is waiting for the AniList sync.

Nothing here assumes prior Supabase experience. Where a step is easy to get
wrong, there's a "how to tell it worked" note.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and sign in.
2. **New project**. Give it a name (`stack`), pick a region physically near you,
   and set a database password. **Save that password somewhere** — you won't
   need it for this app, but you'll need it if you ever connect with `psql`.
3. Free tier is fine. Provisioning takes ~2 minutes.

## 2. Run the schema

1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this repo, copy the **entire** file, paste it
   into the editor, and click **Run**.
3. It should finish with "Success. No rows returned."

**How to tell it worked:** go to **Table Editor**. You should see `profiles`,
`titles`, `ratings`, `library_entries`, `favorites`, `lists`, `list_items`,
`reviews`, `follows`, `activity`, `title_relations` and `airing_schedule`.

> **If you see an error about `pg_trgm` or `unaccent`:** the script creates these
> extensions itself, but on some projects you need to enable them by hand first.
> Go to **Database → Extensions**, search for `pg_trgm` and `unaccent`, enable
> both, then re-run the script.

> **Re-running is safe.** Every statement is `if not exists` / `or replace` /
> `drop policy if exists`. If you edit the schema later, paste and run again.

## 3. Get your keys

Go to **Project Settings → API keys** (and **Project Settings → Data API** for
the URL). You need three values:

| Dashboard label | Goes into |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / publishable key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` / secret key | `SUPABASE_SERVICE_ROLE_KEY` |

Then, in the project root:

```bash
cp .env.example .env.local
```

Fill in the three values. Generate a `CRON_SECRET` with:

```bash
node -e "console.log(require('crypto').randomUUID())"
```

> **The `service_role` key bypasses all security rules.** It is only ever read
> by `scripts/sync-anilist.ts` and `/api/cron/sync`, both server-side. Never put
> it in a `NEXT_PUBLIC_` variable and never commit `.env.local` (it's already
> gitignored).

## 4. Configure auth redirects

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` for now.
- **Redirect URLs**: add both
  - `http://localhost:3000/auth/callback`
  - `https://YOUR-APP.vercel.app/auth/callback` (add once you deploy)

Email/password sign-up works immediately. **Google and Discord buttons on the
login page will error until you enable those providers** under
**Authentication → Providers** and paste in each provider's client ID/secret. If
you don't want them, delete the two `<OAuthButton>` lines in
`src/app/(auth)/auth-form.tsx`.

> By default Supabase requires email confirmation. During local development
> that's annoying — you can turn it off under **Authentication → Sign In /
> Providers → Email → Confirm email**. Turn it back on before you launch.

## 5. Populate the catalog

```bash
npm install
npm run sync:seed
```

This pulls ~2,500 titles from AniList plus the current season and the next two
weeks of airing schedule. It self-throttles to stay inside AniList's rate limit,
so expect **3–5 minutes**. Progress prints as it goes, and it's safe to Ctrl-C
and re-run — every write is an upsert.

**How to tell it worked:** the last line prints the catalog size, and
`http://localhost:3000` shows real cover art instead of the "catalog is empty"
card.

Other sync modes:

```bash
npm run sync:refresh    # current season + airing schedule (fast)
npm run sync:airing     # airing schedule only (very fast — good for a daily cron)
npm run sync:relations  # backfill franchise links (adaptations, sequels)
npm run sync:season SPRING 2024
```

Want a bigger catalog? Raise the `pages` numbers in `SEED_PASSES` near the top of
`scripts/sync-anilist.ts` and re-run `npm run sync:seed`.

## 6. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, create an account, and rate something.

---

## 7. Deploying

The repo is already on GitHub at <https://github.com/etchehexd/stack> (private,
default branch `main`). The Next.js app is at the **repository root**, so Vercel
detects it with no extra configuration.

### Connect Vercel

1. Go to <https://vercel.com/new> and **Import** `etchehexd/stack`. Grant Vercel
   access to the repo when GitHub asks — private repos work fine.
2. Framework preset should auto-fill as **Next.js**. Leave Root Directory empty.
3. Before the first deploy, add your environment variables. The fastest way is
   the **Supabase integration** (next section) for the three Supabase values,
   then add these two by hand under **Settings → Environment Variables**:
   - `NEXT_PUBLIC_SITE_URL` — your real Vercel URL, *not* localhost
   - `CRON_SECRET` — the same value as in `.env.local`
4. Deploy.

From then on, **every push to `main` deploys to production automatically**, and
every pull request gets its own preview URL.

```bash
git add -A
git commit -m "your message"
git push
# → Vercel builds and deploys
```

### Connect Supabase

Use the official integration rather than copying keys by hand — it keeps them in
sync if you ever rotate them:

1. In the **Vercel** dashboard, open your project → **Integrations** → **Browse
   Marketplace** → **Supabase** → **Add Integration**.
2. Pick your Vercel project and your Supabase project, and authorize.
3. It writes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` into the Vercel project for you.

> **Check the variable names after it runs.** The integration has historically
> used `SUPABASE_URL` / `SUPABASE_ANON_KEY` in some configurations. This app
> reads the `NEXT_PUBLIC_`-prefixed names in `.env.example` — the prefix is
> required for the browser client to see them. If the names don't match, add
> the correctly-named ones manually and redeploy.

Optionally, connect Supabase to GitHub too (**Supabase dashboard → Project
Settings → Integrations → GitHub**) so schema changes in `supabase/` can be
applied on merge. That needs the Supabase CLI and a `supabase/migrations/`
folder; right now the schema is one file you run by hand, which is simpler
while you're the only developer.

### After the first deploy

- Add `https://YOUR-APP.vercel.app/auth/callback` to the Supabase redirect URLs
  (step 4) and change the Supabase **Site URL** to your Vercel URL.
- `vercel.json` already registers a daily cron hitting `/api/cron/sync` at 04:00
  UTC, which keeps the current season and airing calendar fresh. Vercel sends
  `CRON_SECRET` automatically once the env var is set. The Hobby plan allows
  daily crons only — that's exactly what's configured.

**Avatars/banners:** the app reads `avatar_url` and `banner_url` from `profiles`,
but there's no upload UI yet. If you add one, create a public **Storage** bucket
called `avatars` in the Supabase dashboard first.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "The catalog is empty" after syncing | Sync wrote to a different project | Check `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` matches the project you ran the schema in |
| Sync fails with "permission denied for table titles" | Using the anon key instead of service role | `SUPABASE_SERVICE_ROLE_KEY` must be the **secret** key |
| Search returns nothing for real titles | `pg_trgm` missing or catalog too small | Enable the extension (step 2) and run `npm run sync:seed` |
| Sign-in does nothing | Email confirmation is on and you haven't clicked the link | Check your inbox, or disable confirmation for local dev |
| OAuth button errors | Provider not enabled | Step 4, or remove the buttons |
| Filter chips are empty on Discover | `facets` view never refreshed | Run `refresh materialized view public.facets;` in the SQL editor |
| Deployed site shows "catalog is empty" but local works | Vercel points at a different Supabase project, or env vars are missing | Compare the Vercel env vars against `.env.local`; redeploy after changing them (env changes don't apply to existing builds) |
| Build fails on Vercel but passes locally | Missing env var, or a case-sensitive import path | Vercel builds on Linux, which is case-sensitive; check the build log for the exact file |
| Sign-in works locally, fails on the deployed site | Redirect URL / Site URL still pointing at localhost | Supabase → Authentication → URL Configuration |
| Cron sync returns 401 | `CRON_SECRET` not set in Vercel, or differs from the one you're testing with | Add it under Settings → Environment Variables and redeploy |

> **The big `sync:seed` is a local job, not a deploy job.** It writes straight to
> Supabase, so run it once from your machine. Vercel's daily cron only does the
> light refresh (current season + airing schedule), which is all it has time for
> inside a serverless function.
