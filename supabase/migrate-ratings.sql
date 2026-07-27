-- =============================================================================
-- STACK - RATINGS MIGRATION  (two-axis  ->  comparative ranking)
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
--
-- Safe to re-run. Every step is guarded. Existing enjoyment/craft ratings are
-- carried over onto the new 0-10 scale as the mean of the two axes, doubled
-- (so 4.5 enjoyment + 4.0 craft becomes 8.5).
--
-- This is exactly the subset of supabase/schema.sql that changed. Running the
-- full schema.sql instead does the same thing plus a few hundred no-ops.
-- =============================================================================

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

-- -----------------------------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------------------------
grant execute on function public.user_stats          to anon, authenticated;
grant execute on function public.bucket_band         to anon, authenticated;
grant execute on function public.place_rating        to authenticated;
grant execute on function public.seed_rating         to authenticated;
grant execute on function public.unrate              to authenticated;
grant execute on function public.recommendations     to authenticated;
