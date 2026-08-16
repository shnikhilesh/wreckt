-- ═══════════════════════════════════════════════════════════
-- Row Level Security policies for Wreckt
-- Run in the Supabase SQL editor after schema.sql
-- ═══════════════════════════════════════════════════════════

-- ─── Enable RLS (safe to re-run) ─────────────────────────
alter table works        enable row level security;
alter table editions     enable row level security;
alter table users        enable row level security;
alter table ratings      enable row level security;
alter table takes        enable row level security;
alter table lists        enable row level security;
alter table list_entries enable row level security;


-- ─── Trigger helpers (SECURITY DEFINER) ──────────────────
-- These functions write across RLS boundaries. Without
-- SECURITY DEFINER, rating inserts would fail to refresh
-- works.cached_rating, and signup would fail to create
-- default lists.

create or replace function refresh_cached_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function create_default_lists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into lists (user_id, name, is_default) values
    (new.id, 'Stack',        true),
    (new.id, 'Reading now',  true),
    (new.id, 'Finished',     true),
    (new.id, 'Dropped',      true);
  return new;
end;
$$;


-- ─── WORKS ───────────────────────────────────────────────
-- Public read. No client write policies — ingestion uses
-- the service role, which bypasses RLS.

drop policy if exists "works are publicly readable" on works;
create policy "works are publicly readable"
  on works for select
  to anon, authenticated
  using (true);


-- ─── EDITIONS ────────────────────────────────────────────
-- Public read. No client write policies.

drop policy if exists "editions are publicly readable" on editions;
create policy "editions are publicly readable"
  on editions for select
  to anon, authenticated
  using (true);


-- ─── USERS ───────────────────────────────────────────────
-- Any profile is readable. Users manage only their own row.

drop policy if exists "profiles are publicly readable" on users;
create policy "profiles are publicly readable"
  on users for select
  to anon, authenticated
  using (true);

drop policy if exists "users can insert their own profile" on users;
create policy "users can insert their own profile"
  on users for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on users;
create policy "users can update their own profile"
  on users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ─── RATINGS ─────────────────────────────────────────────
-- Public read. Users CRUD only their own ratings.

drop policy if exists "ratings are publicly readable" on ratings;
create policy "ratings are publicly readable"
  on ratings for select
  to anon, authenticated
  using (true);

drop policy if exists "users can insert their own ratings" on ratings;
create policy "users can insert their own ratings"
  on ratings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update their own ratings" on ratings;
create policy "users can update their own ratings"
  on ratings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete their own ratings" on ratings;
create policy "users can delete their own ratings"
  on ratings for delete
  to authenticated
  using (auth.uid() = user_id);


-- ─── TAKES ───────────────────────────────────────────────
-- Public read excludes flagged takes. Users CRUD only their own.

drop policy if exists "takes are publicly readable when not flagged" on takes;
create policy "takes are publicly readable when not flagged"
  on takes for select
  to anon, authenticated
  using (not is_flagged);

drop policy if exists "users can insert their own takes" on takes;
create policy "users can insert their own takes"
  on takes for insert
  to authenticated
  with check (auth.uid() = user_id and not is_flagged);

drop policy if exists "users can update their own takes" on takes;
create policy "users can update their own takes"
  on takes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not is_flagged);

drop policy if exists "users can delete their own takes" on takes;
create policy "users can delete their own takes"
  on takes for delete
  to authenticated
  using (auth.uid() = user_id);


-- ─── LISTS ───────────────────────────────────────────────
-- Users read and write only their own lists.

drop policy if exists "users can read their own lists" on lists;
create policy "users can read their own lists"
  on lists for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can create their own lists" on lists;
create policy "users can create their own lists"
  on lists for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update their own lists" on lists;
create policy "users can update their own lists"
  on lists for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete their own lists" on lists;
create policy "users can delete their own lists"
  on lists for delete
  to authenticated
  using (auth.uid() = user_id);


-- ─── LIST_ENTRIES ────────────────────────────────────────
-- Users read and write entries only in lists they own.

drop policy if exists "users can read entries in their own lists" on list_entries;
create policy "users can read entries in their own lists"
  on list_entries for select
  to authenticated
  using (
    exists (
      select 1
      from lists
      where lists.id = list_entries.list_id
        and lists.user_id = auth.uid()
    )
  );

drop policy if exists "users can add entries to their own lists" on list_entries;
create policy "users can add entries to their own lists"
  on list_entries for insert
  to authenticated
  with check (
    exists (
      select 1
      from lists
      where lists.id = list_entries.list_id
        and lists.user_id = auth.uid()
    )
  );

drop policy if exists "users can update entries in their own lists" on list_entries;
create policy "users can update entries in their own lists"
  on list_entries for update
  to authenticated
  using (
    exists (
      select 1
      from lists
      where lists.id = list_entries.list_id
        and lists.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from lists
      where lists.id = list_entries.list_id
        and lists.user_id = auth.uid()
    )
  );

drop policy if exists "users can remove entries from their own lists" on list_entries;
create policy "users can remove entries from their own lists"
  on list_entries for delete
  to authenticated
  using (
    exists (
      select 1
      from lists
      where lists.id = list_entries.list_id
        and lists.user_id = auth.uid()
    )
  );
