-- =============================================================================
-- STACK — Anime / Manga / Light Novel tracker
-- Full Supabase schema: extensions, types, tables, indexes, RLS, functions.
--
-- HOW TO RUN: paste this entire file into the Supabase SQL Editor and hit Run.
-- It is idempotent-ish: safe to re-run on a fresh project. See MANUAL_SETUP.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
create extension if not exists "pg_trgm" with schema extensions;   -- fuzzy search
create extension if not exists "unaccent" with schema extensions;  -- é -> e
create extension if not exists "pgcrypto" with schema extensions;  -- gen_random_uuid

-- -----------------------------------------------------------------------------
-- 2. ENUM TYPES
-- -----------------------------------------------------------------------------
do $$ begin
  create type media_type as enum ('anime', 'manga', 'light_novel');
exception when duplicate_object then null; end $$;

do $$ begin
  create type library_status as enum (
    'watching',    -- also "reading" for manga/LN; label is a UI concern
    'completed',
    'planning',
    'on_hold',
    'dropped',
    'repeating'    -- rewatching / rereading
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_kind as enum (
    'rated', 'status_changed', 'progress', 'completed', 'started',
    'list_created', 'review_posted', 'favorited', 'followed'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 3. HELPERS
-- -----------------------------------------------------------------------------

-- Normalize text for search: lowercase, unaccent, strip punctuation, squash space.
create or replace function public.normalize_search(txt text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select trim(regexp_replace(
    lower(extensions.unaccent(coalesce(txt, ''))),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

-- Builds the search haystack for a title from its four name fields.
--
-- WHY THIS IS A FUNCTION rather than inline SQL in the table definition:
-- a stored generated column may only call functions marked `immutable`, and
-- `array_to_string` is only marked `stable`. Wrapping the whole expression in
-- one immutable function satisfies that check. (Doing the concatenation inline
-- fails with: "generation expression is not immutable".)
create or replace function public.build_search_text(
  romaji text,
  english text,
  native_title text,
  synonyms text[]
)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select public.normalize_search(
    coalesce(romaji, '') || ' ' ||
    coalesce(english, '') || ' ' ||
    coalesce(native_title, '') || ' ' ||
    coalesce(array_to_string(coalesce(synonyms, '{}'::text[]), ' '), '')
  );
$$;

-- Half-star validity: 0.5 .. 5.0 in 0.5 increments.
create or replace function public.is_half_star(v numeric)
returns boolean
language sql
immutable
parallel safe
as $$
  select v is null or (v >= 0.5 and v <= 5.0 and (v * 2) = floor(v * 2));
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 4. PROFILES  (extends auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null
                    check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name    text check (char_length(display_name) <= 48),
  avatar_url      text,
  banner_url      text,
  bio             text check (char_length(bio) <= 500),
  -- User preferences. Kept as a jsonb blob so adding a toggle needs no migration.
  --   overall_sort_enabled: opt-in single-number ("Overall") sort. Default OFF.
  preferences     jsonb not null default
                    '{"overall_sort_enabled": false, "theme": "dark", "adult_content": false}'::jsonb,
  is_private      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile row when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := regexp_replace(
    split_part(coalesce(new.raw_user_meta_data->>'username', new.email, 'user'), '@', 1),
    '[^a-zA-Z0-9_]', '', 'g'
  );
  if char_length(base_username) < 3 then
    base_username := 'user' || base_username;
  end if;
  base_username := left(base_username, 20);
  final_username := base_username;

  while exists (select 1 from public.profiles p where p.username = final_username) loop
    suffix := suffix + 1;
    final_username := left(base_username, 20) || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', final_username),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 5. TITLES  (synced from AniList)
-- -----------------------------------------------------------------------------
create table if not exists public.titles (
  id                uuid primary key default gen_random_uuid(),
  anilist_id        integer unique not null,
  mal_id            integer,
  media_type        media_type not null,
  -- AniList format: TV, TV_SHORT, MOVIE, SPECIAL, OVA, ONA, MUSIC, MANGA, NOVEL, ONE_SHOT
  format            text,
  title_romaji      text,
  title_english     text,
  title_native      text,
  synonyms          text[] not null default '{}',
  synopsis          text,
  cover_image       text,
  cover_image_large text,
  cover_color       text,          -- AniList gives a dominant hex; nice for glass tinting
  banner_image      text,
  season            text,          -- WINTER | SPRING | SUMMER | FALL
  season_year       integer,
  start_date        date,
  end_date          date,
  -- AniList status: FINISHED, RELEASING, NOT_YET_RELEASED, CANCELLED, HIATUS
  status            text,
  episodes          integer,
  duration          integer,       -- minutes per episode
  chapters          integer,
  volumes           integer,
  studios           text[] not null default '{}',
  authors           text[] not null default '{}',
  genres            text[] not null default '{}',
  tags              jsonb not null default '[]'::jsonb,  -- [{name, rank, isSpoiler}]
  average_score     integer,       -- AniList 0-100 community score
  popularity        integer,
  favourites        integer,
  is_adult          boolean not null default false,
  country_of_origin text,
  source            text,          -- MANGA, LIGHT_NOVEL, ORIGINAL, ...
  site_url          text,
  next_airing_at    timestamptz,
  next_airing_ep    integer,
  synced_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),

  -- Generated, normalized haystack for trigram search across every title variant.
  -- The expression must be a single immutable function call — see
  -- build_search_text() above for why.
  search_text       text generated always as (
    public.build_search_text(title_romaji, title_english, title_native, synonyms)
  ) stored
);

-- Trigram index powering typo-tolerant search ("atack on titam" -> Attack on Titan)
create index if not exists titles_search_trgm_idx
  on public.titles using gin (search_text extensions.gin_trgm_ops);

-- Filter / sort support
create index if not exists titles_media_type_idx     on public.titles (media_type);
create index if not exists titles_format_idx         on public.titles (format);
create index if not exists titles_status_idx         on public.titles (status);
create index if not exists titles_season_idx         on public.titles (season_year desc, season);
create index if not exists titles_popularity_idx     on public.titles (popularity desc nulls last);
create index if not exists titles_score_idx          on public.titles (average_score desc nulls last);
create index if not exists titles_genres_gin         on public.titles using gin (genres);
create index if not exists titles_studios_gin        on public.titles using gin (studios);
create index if not exists titles_authors_gin        on public.titles using gin (authors);
create index if not exists titles_next_airing_idx    on public.titles (next_airing_at) where next_airing_at is not null;

-- -----------------------------------------------------------------------------
-- 6. TITLE RELATIONS  (franchise graph)
-- -----------------------------------------------------------------------------
create table if not exists public.title_relations (
  id             bigserial primary key,
  source_id      uuid not null references public.titles(id) on delete cascade,
  target_id      uuid not null references public.titles(id) on delete cascade,
  -- ADAPTATION, PREQUEL, SEQUEL, SIDE_STORY, SPIN_OFF, ALTERNATIVE, ...
  relation_type  text not null,
  unique (source_id, target_id, relation_type)
);
create index if not exists title_relations_source_idx on public.title_relations (source_id);
create index if not exists title_relations_target_idx on public.title_relations (target_id);

-- -----------------------------------------------------------------------------
-- 7. RATINGS  (comparative: a ranked list per bucket, scores derived from it)
--
--     A rating is NOT a number you choose. It's a position in your own ordered
--     list. You pick one of three buckets, the app binary-searches that bucket
--     by asking "which of these two did you prefer", and the 0-10 score falls
--     out of where the title landed:
--
--       bad   0.1 - 3.3      fine  3.4 - 6.7      loved  6.8 - 10.0
--
--     `ord` is the 0-based position inside the bucket, ascending (0 = worst).
--     `score` is always derived from `ord` by respread_bucket() and should
--     never be written by hand except during the manual seeding phase below.
--
--     Seeding: with fewer than RATING_SEED_TARGET titles rated there's nothing
--     to compare against, so the first few are typed in directly and keep the
--     exact score given. The first comparative insert into a bucket respreads
--     it and takes those seeds relative too — which is the point of the model.
-- -----------------------------------------------------------------------------
create table if not exists public.ratings (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title_id   uuid not null references public.titles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

-- --- migration from the old two-axis shape ----------------------------------
-- Safe to re-run: every step is guarded. On a fresh database the columns are
-- simply added and the backfill finds nothing to do.
alter table public.ratings drop constraint if exists ratings_not_empty;
alter table public.ratings add column if not exists bucket text;
alter table public.ratings add column if not exists ord    int;
alter table public.ratings add column if not exists score  numeric(3,1);

do $$
begin
  -- Old rows carried enjoyment + craft on a 0.5-5 scale. Their mean, doubled,
  -- is the same 0-10 figure the new model uses, so ratings survive the change.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ratings'
      and column_name = 'enjoyment'
  ) then
    update public.ratings
       set score = least(10.0, greatest(0.1, round(
             (coalesce(enjoyment, craft) + coalesce(craft, enjoyment))::numeric, 1)))
     where score is null
       and (enjoyment is not null or craft is not null);

    alter table public.ratings drop column if exists enjoyment;
    alter table public.ratings drop column if exists craft;
  end if;
end $$;

update public.ratings set score = 5.0 where score is null;
update public.ratings
   set bucket = case when score >= 6.8 then 'loved'
                     when score >= 3.4 then 'fine'
                     else 'bad' end
 where bucket is null;

-- Give every pre-existing row a position inside its bucket, worst first.
with numbered as (
  select user_id, title_id,
         row_number() over (partition by user_id, bucket order by score, title_id) - 1 as i
  from public.ratings
  where ord is null
)
update public.ratings r
   set ord = n.i
  from numbered n
 where r.user_id = n.user_id and r.title_id = n.title_id;

alter table public.ratings alter column bucket set not null;
alter table public.ratings alter column ord    set not null;
alter table public.ratings alter column score  set not null;
alter table public.ratings alter column ord    set default 0;
alter table public.ratings alter column score  set default 5.0;

alter table public.ratings drop constraint if exists ratings_bucket_valid;
alter table public.ratings add  constraint ratings_bucket_valid
  check (bucket in ('loved', 'fine', 'bad'));
alter table public.ratings drop constraint if exists ratings_score_range;
alter table public.ratings add  constraint ratings_score_range
  check (score >= 0 and score <= 10);

drop trigger if exists ratings_touch on public.ratings;
create trigger ratings_touch before update on public.ratings
  for each row execute function public.touch_updated_at();

drop index if exists public.ratings_enjoyment_idx;
drop index if exists public.ratings_craft_idx;
create index if not exists ratings_user_idx   on public.ratings (user_id);
create index if not exists ratings_title_idx  on public.ratings (title_id);
create index if not exists ratings_score_idx  on public.ratings (user_id, score desc);
create index if not exists ratings_bucket_idx on public.ratings (user_id, bucket, ord);

-- -----------------------------------------------------------------------------
-- 8. LIBRARY ENTRIES
-- -----------------------------------------------------------------------------
create table if not exists public.library_entries (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  title_id         uuid not null references public.titles(id) on delete cascade,
  status           library_status not null default 'planning',
  progress         integer not null default 0 check (progress >= 0),   -- episodes or chapters
  -- Volume progress is ALWAYS user-owned and optional. AniList volume counts are
  -- unreliable, so this is a free manual field: never auto-filled, never required.
  progress_volumes integer check (progress_volumes >= 0),
  repeat_count     integer not null default 0 check (repeat_count >= 0),
  started_at       date,
  completed_at     date,
  notes            text check (char_length(notes) <= 2000),
  is_private       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, title_id)
);

drop trigger if exists library_touch on public.library_entries;
create trigger library_touch before update on public.library_entries
  for each row execute function public.touch_updated_at();

create index if not exists library_user_status_idx  on public.library_entries (user_id, status);
create index if not exists library_user_updated_idx on public.library_entries (user_id, updated_at desc);
create index if not exists library_title_idx        on public.library_entries (title_id);

-- -----------------------------------------------------------------------------
-- 9. FAVORITES (pinned titles on the profile)
-- -----------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title_id   uuid not null references public.titles(id) on delete cascade,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, title_id)
);
create index if not exists favorites_user_idx on public.favorites (user_id, position);

-- -----------------------------------------------------------------------------
-- 10. LISTS
-- -----------------------------------------------------------------------------
create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  slug        text not null,
  is_public   boolean not null default true,
  is_ranked   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slug)
);

drop trigger if exists lists_touch on public.lists;
create trigger lists_touch before update on public.lists
  for each row execute function public.touch_updated_at();

create table if not exists public.list_items (
  list_id    uuid not null references public.lists(id) on delete cascade,
  title_id   uuid not null references public.titles(id) on delete cascade,
  position   integer not null default 0,
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (list_id, title_id)
);
create index if not exists list_items_list_idx on public.list_items (list_id, position);

-- -----------------------------------------------------------------------------
-- 11. REVIEWS
-- -----------------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title_id    uuid not null references public.titles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 20000),
  has_spoilers boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, title_id)
);

drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

create index if not exists reviews_title_idx on public.reviews (title_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 12. FOLLOWS
-- -----------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

-- -----------------------------------------------------------------------------
-- 13. ACTIVITY FEED
-- -----------------------------------------------------------------------------
create table if not exists public.activity (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title_id   uuid references public.titles(id) on delete cascade,
  kind       activity_kind not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_user_idx    on public.activity (user_id, created_at desc);
create index if not exists activity_created_idx on public.activity (created_at desc);

-- -----------------------------------------------------------------------------
-- 14. AIRING SCHEDULE
-- -----------------------------------------------------------------------------
create table if not exists public.airing_schedule (
  id            bigint primary key,             -- AniList airingSchedule id
  title_id      uuid not null references public.titles(id) on delete cascade,
  episode       integer not null,
  airing_at     timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists airing_at_idx       on public.airing_schedule (airing_at);
create index if not exists airing_title_idx    on public.airing_schedule (title_id, episode);

-- -----------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY
--     Rule of thumb: catalog data is world-readable; user data is owner-writable
--     and publicly readable unless the row or profile is marked private.
-- -----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.titles          enable row level security;
alter table public.title_relations enable row level security;
alter table public.ratings         enable row level security;
alter table public.library_entries enable row level security;
alter table public.favorites       enable row level security;
alter table public.lists           enable row level security;
alter table public.list_items      enable row level security;
alter table public.reviews         enable row level security;
alter table public.follows         enable row level security;
alter table public.activity        enable row level security;
alter table public.airing_schedule enable row level security;

-- Helper: is the given profile visible to the current requester?
create or replace function public.profile_visible(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and (p.is_private = false or p.id = auth.uid())
  );
$$;

-- --- profiles ---------------------------------------------------------------
drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
  for select using (true);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- --- titles / relations / airing (catalog: read-only to clients) ------------
drop policy if exists "titles readable" on public.titles;
create policy "titles readable" on public.titles for select using (true);

drop policy if exists "relations readable" on public.title_relations;
create policy "relations readable" on public.title_relations for select using (true);

drop policy if exists "airing readable" on public.airing_schedule;
create policy "airing readable" on public.airing_schedule for select using (true);
-- NOTE: no insert/update/delete policies => only the service_role key (used by
-- the AniList sync script) can write the catalog. That is intentional.

-- --- ratings ----------------------------------------------------------------
drop policy if exists "ratings readable" on public.ratings;
create policy "ratings readable" on public.ratings
  for select using (public.profile_visible(user_id));

drop policy if exists "own ratings write" on public.ratings;
create policy "own ratings write" on public.ratings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- library ----------------------------------------------------------------
drop policy if exists "library readable" on public.library_entries;
create policy "library readable" on public.library_entries
  for select using (
    auth.uid() = user_id or (is_private = false and public.profile_visible(user_id))
  );

drop policy if exists "own library write" on public.library_entries;
create policy "own library write" on public.library_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- favorites --------------------------------------------------------------
drop policy if exists "favorites readable" on public.favorites;
create policy "favorites readable" on public.favorites
  for select using (public.profile_visible(user_id));

drop policy if exists "own favorites write" on public.favorites;
create policy "own favorites write" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- lists ------------------------------------------------------------------
drop policy if exists "lists readable" on public.lists;
create policy "lists readable" on public.lists
  for select using (
    auth.uid() = user_id or (is_public and public.profile_visible(user_id))
  );

drop policy if exists "own lists write" on public.lists;
create policy "own lists write" on public.lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "list items readable" on public.list_items;
create policy "list items readable" on public.list_items
  for select using (exists (
    select 1 from public.lists l
    where l.id = list_id
      and (l.user_id = auth.uid() or (l.is_public and public.profile_visible(l.user_id)))
  ));

drop policy if exists "own list items write" on public.list_items;
create policy "own list items write" on public.list_items
  for all using (exists (
    select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()
  ));

-- --- reviews ----------------------------------------------------------------
drop policy if exists "reviews readable" on public.reviews;
create policy "reviews readable" on public.reviews
  for select using (public.profile_visible(user_id));

drop policy if exists "own reviews write" on public.reviews;
create policy "own reviews write" on public.reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- follows ----------------------------------------------------------------
drop policy if exists "follows readable" on public.follows;
create policy "follows readable" on public.follows for select using (true);

drop policy if exists "own follows write" on public.follows;
create policy "own follows write" on public.follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- --- activity ---------------------------------------------------------------
drop policy if exists "activity readable" on public.activity;
create policy "activity readable" on public.activity
  for select using (public.profile_visible(user_id));

drop policy if exists "own activity write" on public.activity;
create policy "own activity write" on public.activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 16. SEARCH + FILTER RPC
--     One function handles fuzzy search AND the tri-state include/exclude
--     filters, so the client never has to stitch together 12 PostgREST params.
--     Tri-state: a chip in "include" must match; a chip in "exclude" must not.
-- -----------------------------------------------------------------------------
create or replace function public.search_titles(
  p_query           text default null,
  p_media_types     media_type[] default null,
  p_formats         text[] default null,
  p_exclude_formats text[] default null,
  p_statuses        text[] default null,
  p_exclude_statuses text[] default null,
  p_include_genres  text[] default null,
  p_exclude_genres  text[] default null,
  p_include_studios text[] default null,
  p_exclude_studios text[] default null,
  p_year_min        int default null,
  p_year_max        int default null,
  p_season          text default null,
  p_count_min       int default null,   -- episodes (anime) / chapters (manga+LN)
  p_count_max       int default null,
  p_score_min       int default null,   -- community average, 0-100
  p_score_max       int default null,
  p_include_adult   boolean default false,
  p_sort            text default 'popularity', -- popularity|score|trending|newest|title|relevance
  p_limit           int default 40,
  p_offset          int default 0
)
returns table (
  id uuid, anilist_id int, media_type media_type, format text,
  title_romaji text, title_english text, title_native text,
  cover_image_large text, cover_color text, banner_image text,
  season text, season_year int, status text,
  episodes int, chapters int, volumes int,
  studios text[], authors text[], genres text[],
  average_score int, popularity int, synopsis text,
  relevance real, total_count bigint
)
language sql
stable
security definer
set search_path = public, extensions
-- ---------------------------------------------------------------------------
-- TYPO TOLERANCE — and why the threshold is written inline rather than SET.
--
-- word_similarity() compares the query against the best-matching SPAN of
-- search_text rather than the whole string. Without that, a 3-word query
-- against a long multi-title haystack always scores below any useful
-- threshold. 0.3 tolerates roughly two typos in a short title.
--
-- This used to read `set pg_trgm.word_similarity_threshold = '0.3'` here and
-- use the `%>` operator, which reads that GUC. Don't do that: pg_trgm lives in
-- the `extensions` schema and its custom GUCs only get registered once the
-- extension's library is loaded into the session. In a fresh SQL Editor
-- session it isn't, so Postgres treats the name as an unknown placeholder —
-- and only a superuser may SET a placeholder. On Supabase the postgres role
-- isn't one, so running this file failed with:
--
--   ERROR: 42501: permission denied to set parameter
--          "pg_trgm.word_similarity_threshold"
--
-- It's load-order dependent, which is worse than broken: it succeeds if some
-- earlier query happened to load pg_trgm and fails otherwise. The threshold is
-- compared explicitly below instead, so nothing depends on session state.
-- ---------------------------------------------------------------------------
as $$
  with normalized as (
    select nullif(public.normalize_search(p_query), '') as q
  ),
  filtered as (
    select t.*,
      case
        when n.q is null then 0::real
        -- exact/prefix hits beat fuzzy hits, then fall back to fuzzy scoring
        when t.search_text like n.q || '%' then 1.0::real
        when t.search_text like '%' || n.q || '%' then 0.9::real
        else extensions.word_similarity(n.q, t.search_text)
      end as rel
    from public.titles t cross join normalized n
    where
      -- Explicit threshold instead of the `%>` operator — see the note above the
      -- function body. The substring test is listed first because it's the
      -- cheap, index-friendly case and short-circuits the fuzzy scan for the
      -- overwhelming majority of real queries.
      (
        n.q is null
        or t.search_text like '%' || n.q || '%'
        or extensions.word_similarity(n.q, t.search_text) >= 0.3
      )
      and (p_media_types    is null or t.media_type = any(p_media_types))
      and (p_formats        is null or t.format = any(p_formats))
      and (p_exclude_formats is null or t.format is null or not (t.format = any(p_exclude_formats)))
      and (p_statuses       is null or t.status = any(p_statuses))
      and (p_exclude_statuses is null or t.status is null or not (t.status = any(p_exclude_statuses)))
      and (p_include_genres is null or t.genres @> p_include_genres)
      and (p_exclude_genres is null or not (t.genres && p_exclude_genres))
      and (p_include_studios is null or t.studios && p_include_studios or t.authors && p_include_studios)
      and (p_exclude_studios is null or not (t.studios && p_exclude_studios or t.authors && p_exclude_studios))
      and (p_year_min  is null or t.season_year >= p_year_min)
      and (p_year_max  is null or t.season_year <= p_year_max)
      and (p_season    is null or t.season = p_season)
      and (p_count_min is null or coalesce(t.episodes, t.chapters) >= p_count_min)
      and (p_count_max is null or coalesce(t.episodes, t.chapters) <= p_count_max)
      and (p_score_min is null or t.average_score >= p_score_min)
      and (p_score_max is null or t.average_score <= p_score_max)
      and (p_include_adult or t.is_adult = false)
  ),
  counted as (select count(*) as n from filtered)
  select f.id, f.anilist_id, f.media_type, f.format,
         f.title_romaji, f.title_english, f.title_native,
         f.cover_image_large, f.cover_color, f.banner_image,
         f.season, f.season_year, f.status,
         f.episodes, f.chapters, f.volumes,
         f.studios, f.authors, f.genres,
         f.average_score, f.popularity, f.synopsis,
         f.rel, c.n
  from filtered f cross join counted c
  order by
    case when p_sort = 'relevance' or p_query is not null then f.rel end desc nulls last,
    case when p_sort = 'score'      then f.average_score end desc nulls last,
    case when p_sort = 'newest'     then f.start_date end desc nulls last,
    case when p_sort = 'title'      then coalesce(f.title_english, f.title_romaji) end asc,
    f.popularity desc nulls last
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
$$;

-- Lower the trigram threshold a touch: default 0.3 is too strict for long titles.
-- (Applied per-session by the client; see lib/supabase/queries.ts.)

-- -----------------------------------------------------------------------------
-- 17. PROFILE STATS RPC
-- -----------------------------------------------------------------------------
-- -----------------------------------------------------------------------------
-- 17b. COMPARATIVE RATING RPCs
--      All four are SECURITY DEFINER and act on auth.uid() only — a caller can
--      never reorder somebody else's list.
-- -----------------------------------------------------------------------------

/** The 0-10 span each bucket owns. Change these to retune the whole scale. */
create or replace function public.bucket_band(p_bucket text)
returns numeric[]
language sql
immutable
as $$
  select case p_bucket
    when 'loved' then array[6.8, 10.0]
    when 'fine'  then array[3.4,  6.7]
    else              array[0.1,  3.3]
  end;
$$;

/**
 * Renumber a bucket 0..n-1 by `ord`, then spread scores evenly across the
 * band. This is the ONLY thing that writes `score` outside manual seeding.
 * A lone title in a bucket sits at the band's midpoint rather than its top —
 * one rating is not evidence that something is your favourite ever.
 */
create or replace function public.respread_bucket(p_user_id uuid, p_bucket text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  band numeric[];
  lo numeric;
  hi numeric;
  n  int;
begin
  band := public.bucket_band(p_bucket);
  lo := band[1];
  hi := band[2];

  select count(*) into n
    from public.ratings
   where user_id = p_user_id and bucket = p_bucket;

  if n = 0 then
    return;
  end if;

  with ordered as (
    select title_id,
           row_number() over (order by ord, updated_at, title_id) - 1 as i
      from public.ratings
     where user_id = p_user_id and bucket = p_bucket
  )
  update public.ratings r
     set ord   = o.i,
         score = round(
           (case when n = 1 then (lo + hi) / 2
                 else lo + (hi - lo) * o.i::numeric / (n - 1)
            end)::numeric, 1)
    from ordered o
   where r.user_id = p_user_id
     and r.title_id = o.title_id;
end;
$$;

/**
 * Place a title at `p_position` inside a bucket (0 = worst) and rescore the
 * bucket. Returns the resulting score.
 *
 * The row is deleted before reinsertion so that a title moving *within* its
 * own bucket doesn't have to be special-cased — positions are always computed
 * against the list without it.
 */
create or replace function public.place_rating(
  p_title_id uuid,
  p_bucket   text,
  p_position int
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  old_bucket text;
  new_score  numeric;
  pos        int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_bucket not in ('loved', 'fine', 'bad') then
    raise exception 'unknown bucket %', p_bucket;
  end if;

  select bucket into old_bucket
    from public.ratings
   where user_id = uid and title_id = p_title_id;

  delete from public.ratings where user_id = uid and title_id = p_title_id;

  if old_bucket is not null and old_bucket <> p_bucket then
    perform public.respread_bucket(uid, old_bucket);
  end if;

  select greatest(0, least(coalesce(p_position, 0), count(*)::int)) into pos
    from public.ratings
   where user_id = uid and bucket = p_bucket;

  update public.ratings
     set ord = ord + 1
   where user_id = uid and bucket = p_bucket and ord >= pos;

  insert into public.ratings (user_id, title_id, bucket, ord, score)
  values (uid, p_title_id, p_bucket, pos, 5.0);

  perform public.respread_bucket(uid, p_bucket);

  select score into new_score
    from public.ratings
   where user_id = uid and title_id = p_title_id;

  return new_score;
end;
$$;

/**
 * Seeding path: store an exact typed score and slot the title into its bucket
 * by that score. Deliberately does NOT respread — during seeding the number
 * the user typed is the number they keep.
 */
create or replace function public.seed_rating(
  p_title_id uuid,
  p_score    numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s   numeric := round(least(10.0, greatest(0.1, p_score))::numeric, 1);
  b   text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  b := case when s >= 6.8 then 'loved'
            when s >= 3.4 then 'fine'
            else 'bad' end;

  insert into public.ratings (user_id, title_id, bucket, ord, score)
  values (uid, p_title_id, b, 0, s)
  on conflict (user_id, title_id)
  do update set bucket = excluded.bucket, score = excluded.score;

  -- Positions only; scores are left exactly as typed.
  with ordered as (
    select title_id, row_number() over (order by score, title_id) - 1 as i
      from public.ratings
     where user_id = uid and bucket = b
  )
  update public.ratings r
     set ord = o.i
    from ordered o
   where r.user_id = uid and r.title_id = o.title_id;

  return s;
end;
$$;

create or replace function public.unrate(p_title_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  b   text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select bucket into b
    from public.ratings
   where user_id = uid and title_id = p_title_id;

  delete from public.ratings where user_id = uid and title_id = p_title_id;

  if b is not null then
    perform public.respread_bucket(uid, b);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 17c. USER STATS
-- -----------------------------------------------------------------------------
create or replace function public.user_stats(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with lib as (
    select le.*, t.media_type, t.episodes, t.duration, t.chapters
    from public.library_entries le
    join public.titles t on t.id = le.title_id
    where le.user_id = p_user_id
  ),
  r as (
    select * from public.ratings where user_id = p_user_id
  ),
  genre_counts as (
    select g as genre, count(*) as n
    from lib l
    join public.titles t on t.id = l.title_id, unnest(t.genres) g
    where l.status in ('completed', 'watching', 'repeating')
    group by g order by n desc limit 12
  ),
  studio_counts as (
    select s as studio, count(*) as n
    from lib l
    join public.titles t on t.id = l.title_id, unnest(t.studios || t.authors) s
    where l.status in ('completed', 'watching', 'repeating')
    group by s order by n desc limit 10
  )
  select jsonb_build_object(
    'total_entries',      (select count(*) from lib),
    'anime_count',        (select count(*) from lib where media_type = 'anime'),
    'manga_count',        (select count(*) from lib where media_type = 'manga'),
    'ln_count',           (select count(*) from lib where media_type = 'light_novel'),
    'completed',          (select count(*) from lib where status = 'completed'),
    'watching',           (select count(*) from lib where status in ('watching','repeating')),
    'planning',           (select count(*) from lib where status = 'planning'),
    'dropped',            (select count(*) from lib where status = 'dropped'),
    'on_hold',            (select count(*) from lib where status = 'on_hold'),
    'episodes_watched',   (select coalesce(sum(progress), 0) from lib where media_type = 'anime'),
    'minutes_watched',    (select coalesce(sum(progress * coalesce(duration, 24)), 0)
                             from lib where media_type = 'anime'),
    'chapters_read',      (select coalesce(sum(progress), 0) from lib where media_type <> 'anime'),
    'volumes_read',       (select coalesce(sum(progress_volumes), 0) from lib where media_type <> 'anime'),
    'rated_count',        (select count(*) from r),
    'avg_score',          (select round(avg(score)::numeric, 2) from r),
    'buckets', jsonb_build_object(
      'loved', (select count(*) from r where bucket = 'loved'),
      'fine',  (select count(*) from r where bucket = 'fine'),
      'bad',   (select count(*) from r where bucket = 'bad')
    ),
    'top_genres',  (select coalesce(jsonb_agg(jsonb_build_object('name', genre, 'count', n)), '[]'::jsonb) from genre_counts),
    'top_studios', (select coalesce(jsonb_agg(jsonb_build_object('name', studio, 'count', n)), '[]'::jsonb) from studio_counts)
  );
$$;

-- -----------------------------------------------------------------------------
-- 18. RECOMMENDATIONS RPC
--     Heuristic: find the genres concentrated in the titles the user placed
--     highest, then surface popular unrated titles that match them.
-- -----------------------------------------------------------------------------
create or replace function public.recommendations(
  p_user_id uuid,
  p_media_type media_type default null,
  p_limit int default 20
)
returns table (
  id uuid, media_type media_type, format text,
  title_romaji text, title_english text,
  cover_image_large text, cover_color text,
  average_score int, popularity int, genres text[], season_year int,
  match_score real
)
language sql
stable
security definer
set search_path = public
as $$
  with loved as (
    -- weight each rated title by how far above "fine" it landed
    select t.genres, (r.score - 6.0)::real as w
    from public.ratings r
    join public.titles t on t.id = r.title_id
    where r.user_id = p_user_id
      and r.score >= 6.8
  ),
  genre_weights as (
    select g as genre, sum(w) as weight
    from loved, unnest(genres) g
    group by g
  ),
  seen as (
    select title_id from public.library_entries where user_id = p_user_id
    union
    select title_id from public.ratings where user_id = p_user_id
  )
  select t.id, t.media_type, t.format, t.title_romaji, t.title_english,
         t.cover_image_large, t.cover_color, t.average_score, t.popularity,
         t.genres, t.season_year,
         (coalesce(sum(gw.weight), 0) * (coalesce(t.average_score, 60) / 100.0))::real as match_score
  from public.titles t
  join genre_weights gw on gw.genre = any(t.genres)
  where t.id not in (select title_id from seen)
    and t.is_adult = false
    and coalesce(t.average_score, 0) >= 65
    and (p_media_type is null or t.media_type = p_media_type)
  group by t.id
  order by match_score desc, t.popularity desc nulls last
  limit greatest(1, least(p_limit, 50));
$$;

-- -----------------------------------------------------------------------------
-- 19. TASTE COMPATIBILITY RPC
--     Distance between two users across the titles they have both rated.
-- -----------------------------------------------------------------------------
create or replace function public.taste_compatibility(p_a uuid, p_b uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with shared as (
    select a.score as sa, b.score as sb
    from public.ratings a
    join public.ratings b on b.title_id = a.title_id and b.user_id = p_b
    where a.user_id = p_a
  )
  select jsonb_build_object(
    'shared_count', (select count(*) from shared),
    -- mean absolute gap on a 0-10 scale, inverted into a 0-100 score
    'compatibility', (
      select case when count(*) = 0 then null else
        round((100 * (1 - avg(abs(sa - sb)) / 10.0))::numeric, 0)
      end from shared
    ),
    'score_gap', (select round(avg(abs(sa - sb))::numeric, 2) from shared)
  );
$$;

-- 20. FILTER FACETS  (populate the Discover chips without a full table scan
--     on every keystroke — refresh this materialized view after each sync)
-- -----------------------------------------------------------------------------
drop materialized view if exists public.facets cascade;
create materialized view public.facets as
  select 'genre'::text as kind, g as value, count(*)::bigint as n
  from public.titles, unnest(genres) g group by g
  union all
  select 'studio', s, count(*)::bigint
  from public.titles, unnest(studios) s group by s having count(*) >= 3
  union all
  select 'author', a, count(*)::bigint
  from public.titles, unnest(authors) a group by a having count(*) >= 2
  union all
  select 'format', format, count(*)::bigint
  from public.titles where format is not null group by format;

create unique index if not exists facets_uniq on public.facets (kind, value);
grant select on public.facets to anon, authenticated;

-- Called by the sync script once new titles land. `concurrently` needs the
-- unique index above, and lets Discover keep serving during the refresh.
create or replace function public.refresh_facets()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.facets;
exception when others then
  -- First refresh after creation cannot be concurrent; fall back.
  refresh materialized view public.facets;
end $$;

-- Populate it once so Discover has chips before the first sync finishes.
refresh materialized view public.facets;

-- -----------------------------------------------------------------------------
-- 21. GRANTS
-- -----------------------------------------------------------------------------
grant execute on function public.search_titles       to anon, authenticated;
grant execute on function public.user_stats          to anon, authenticated;
grant execute on function public.bucket_band         to anon, authenticated;
grant execute on function public.place_rating        to authenticated;
grant execute on function public.seed_rating         to authenticated;
grant execute on function public.unrate              to authenticated;
grant execute on function public.recommendations     to authenticated;
grant execute on function public.taste_compatibility to authenticated;
grant execute on function public.normalize_search    to anon, authenticated;
-- refresh_facets is intentionally service_role-only (the sync script calls it).
revoke execute on function public.refresh_facets from anon, authenticated;

-- =============================================================================
-- Done. Next: run `npm run sync:anilist` to populate public.titles.
-- =============================================================================
