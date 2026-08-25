-- 允许 role = 'boss'(老板只读数据权限,见 can_view_analytics / /dashboard)。
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role::text = any (array['user','provider','admin','banned','boss']::text[]));
