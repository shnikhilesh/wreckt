-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── WORKS ───────────────────────────────────────────────
-- One row per canonical book (not per edition).
-- This is the thing users rate, take on, and list.
create table works (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author_name     text not null,
  pub_year        int,
  ol_work_key     text unique,            -- Open Library key e.g. /works/OL45804W
  description     text,
  genres          text[],                 -- e.g. {'fiction','dystopia'}
  cover_url       text,
  cached_rating   numeric(3,2),
  rating_count    int not null default 0,
  created_at      timestamptz not null default now()
);

create index on works (author_name);
create index on works
  using gin(to_tsvector('english', title || ' ' || author_name));


-- ─── EDITIONS ────────────────────────────────────────────
-- One row per physical/digital edition.
-- Ratings and takes live on the parent work, not editions.
create table editions (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references works(id) on delete cascade,
  isbn_13         text unique,
  isbn_10         text,
  format          text,     -- 'hardback' | 'paperback' | 'ebook' | 'audiobook'
  pub_year        int,
  publisher       text,
  language        text not null default 'en',
  ol_edition_key  text unique
);

create index on editions (work_id);
create index on editions (isbn_13);


-- ─── USERS ───────────────────────────────────────────────
-- Mirrors Supabase auth.users. Keep this thin.
create table users (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  created_at      timestamptz not null default now(),
  account_age_at  timestamptz   -- NULL until account is 30 days old; used later for vote weighting
);


-- ─── RATINGS ─────────────────────────────────────────────
-- Raw votes — never aggregate directly, always use the view.
create table ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  work_id     uuid not null references works(id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  created_at  timestamptz not null default now(),
  is_flagged  boolean not null default false,
  unique (user_id, work_id)   -- one rating per user per work
);

create index on ratings (work_id) where not is_flagged;
create index on ratings (user_id);

-- Accurate rating view — always query this, not cached_rating, for display
create view work_ratings as
  select
    work_id,
    round(avg(score)::numeric, 2)          as avg_score,
    count(*)                                as total_votes,
    count(*) filter (where is_flagged)      as flagged_votes
  from ratings
  where not is_flagged
  group by work_id;

-- Trigger to keep works.cached_rating in sync for fast listing pages
create or replace function refresh_cached_rating()
returns trigger language plpgsql as $$
begin
  update works
  set
    cached_rating = (
      select round(avg(score)::numeric, 2)
      from ratings
      where work_id = coalesce(new.work_id, old.work_id)
        and not is_flagged
    ),
    rating_count = (
      select count(*)
      from ratings
      where work_id = coalesce(new.work_id, old.work_id)
        and not is_flagged
    )
  where id = coalesce(new.work_id, old.work_id);
  return new;
end;
$$;

create trigger trg_rating_cache
after insert or update or delete on ratings
for each row execute function refresh_cached_rating();


-- ─── TAKES ───────────────────────────────────────────────
-- Wreckt vocabulary for reviews.
-- "Write your take" — short, informal, one per user per work.
create table takes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  work_id           uuid not null references works(id) on delete cascade,
  body              text not null check (length(body) between 10 and 500),
  resonated_count   int not null default 0,   -- replaces upvotes
  created_at        timestamptz not null default now(),
  is_flagged        boolean not null default false,
  unique (user_id, work_id)   -- one take per user per work, editable in place
);

create index on takes (work_id) where not is_flagged;
create index on takes (user_id);


-- ─── LISTS ───────────────────────────────────────────────
-- Wreckt vocabulary for shelves.
-- Four default lists created automatically on signup.
create table lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table list_entries (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references lists(id) on delete cascade,
  work_id     uuid not null references works(id) on delete cascade,
  added_at    timestamptz not null default now(),
  unique (list_id, work_id)   -- a book appears once per list
);

create index on list_entries (list_id);
create index on list_entries (work_id);

-- Auto-create Wreckt's four default lists on new user signup
create or replace function create_default_lists()
returns trigger language plpgsql as $$
begin
  insert into lists (user_id, name, is_default) values
    (new.id, 'Stack',        true),   -- want to read
    (new.id, 'Reading now',  true),   -- currently reading
    (new.id, 'Finished',     true),   -- read
    (new.id, 'Dropped',      true);   -- DNF — first-class state, Wreckt differentiator
  return new;
end;
$$;

create trigger trg_default_lists
after insert on users
for each row execute function create_default_lists();


-- ─── RESONATED_BY ────────────────────────────────────────
-- Tracks which users have resonated with which takes.
-- "Resonated" is Wreckt's take-acknowledgement — not a like/upvote.
create table resonated_by (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  take_id     uuid not null references takes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, take_id)   -- one resonation per user per take
);

create index on resonated_by (take_id);
create index on resonated_by (user_id);

-- Keep takes.resonated_count in sync — same pattern as refresh_cached_rating
-- above. The client never writes resonated_count directly; it only writes
-- to resonated_by, which only its own owner can write to under RLS.
create or replace function refresh_resonated_count()
returns trigger language plpgsql as $$
begin
  update takes
  set resonated_count = (
    select count(*) from resonated_by
    where take_id = coalesce(new.take_id, old.take_id)
  )
  where id = coalesce(new.take_id, old.take_id);
  return coalesce(new, old);
end;
$$;

create trigger trg_resonated_count
after insert or delete on resonated_by
for each row execute function refresh_resonated_count();
