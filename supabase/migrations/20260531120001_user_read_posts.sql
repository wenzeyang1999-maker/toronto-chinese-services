-- Track which posts each logged-in user has read, so read state
-- survives across devices and browser clears.
create table if not exists public.user_read_posts (
  id       uuid        primary key default gen_random_uuid(),
  user_id  uuid        not null references auth.users(id) on delete cascade,
  type     text        not null check (type in ('service','job','property','secondhand','event','community')),
  post_id  text        not null,
  read_at  timestamptz not null default now(),
  unique (user_id, type, post_id)
);

alter table public.user_read_posts enable row level security;

create policy "users can select own read_posts"
  on public.user_read_posts for select
  using (auth.uid() = user_id);

create policy "users can insert own read_posts"
  on public.user_read_posts for insert
  with check (auth.uid() = user_id);
