-- saved_searches — cross-device persistence for a user's subscribed searches.
-- Previously stored only in localStorage (lost on new device / cleared cache).
-- newCount/"new results" badges are derived client-side from loaded services,
-- so they are intentionally NOT persisted here; only last_checked_at is kept.

create table if not exists public.saved_searches (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  keyword         text not null,
  category        text,
  label           text not null,
  last_checked_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- One saved search per (user, keyword, category). coalesce() so NULL categories
-- dedupe correctly (NULLs are otherwise treated as distinct by a plain unique).
create unique index if not exists uniq_saved_search
  on public.saved_searches (user_id, keyword, coalesce(category, ''));

create index if not exists idx_saved_searches_user
  on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;

drop policy if exists "saved_searches_select_own" on public.saved_searches;
create policy "saved_searches_select_own" on public.saved_searches
  for select using (auth.uid() = user_id);

drop policy if exists "saved_searches_insert_own" on public.saved_searches;
create policy "saved_searches_insert_own" on public.saved_searches
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_searches_update_own" on public.saved_searches;
create policy "saved_searches_update_own" on public.saved_searches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_searches_delete_own" on public.saved_searches;
create policy "saved_searches_delete_own" on public.saved_searches
  for delete using (auth.uid() = user_id);
