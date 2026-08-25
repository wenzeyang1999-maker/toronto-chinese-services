-- ─── 老板专属「只读数据」权限(boss)───────────────────────────────────────────
-- 新增角色 'boss':能看数据后台(admin_backend_metrics / admin_activity_feed),
-- 但不是 admin —— 看不到 /admin 的运营 tab(举报/纠纷/用户管理等,那些仍只认 role='admin')。
-- 数据 RPC 的闸门从 is_admin() 放宽到 can_view_analytics()(admin 或 boss)。

create or replace function public.can_view_analytics()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role in ('admin','boss'))
$$;

-- 汇总指标:闸门改为 can_view_analytics()
create or replace function public.admin_backend_metrics()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
  if not can_view_analytics() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'users_total',        (select count(*) from users),
    'users_1d',           (select count(*) from users where created_at > now() - interval '1 day'),
    'users_7d',           (select count(*) from users where created_at > now() - interval '7 days'),
    'users_30d',          (select count(*) from users where created_at > now() - interval '30 days'),
    'dau',                (select count(*) from users where last_seen_at > now() - interval '1 day'),
    'wau',                (select count(*) from users where last_seen_at > now() - interval '7 days'),
    'mau',                (select count(*) from users where last_seen_at > now() - interval '30 days'),
    'online_providers',   (select count(*) from users where is_online is true),
    'services',           (select count(*) from services),
    'jobs',               (select count(*) from jobs),
    'properties',         (select count(*) from properties),
    'secondhand',         (select count(*) from secondhand),
    'events',             (select count(*) from events),
    'community',          (select count(*) from community_posts),
    'inquiries_total',    (select count(*) from inquiries),
    'inquiries_7d',       (select count(*) from inquiries where created_at > now() - interval '7 days'),
    'conversations',      (select count(*) from conversations),
    'messages_total',     (select count(*) from messages),
    'messages_7d',        (select count(*) from messages where created_at > now() - interval '7 days'),
    'orders_total',       (select count(*) from orders),
    'orders_done',        (select count(*) from orders where status in ('confirmed','completed')),
    'gmv',                (select coalesce(sum(amount),0) from orders where status in ('confirmed','completed')),
    'generated_at',       now()
  );
end;
$$;

create or replace function public.admin_activity_feed(p_limit int default 40)
returns table(kind text, label text, at timestamptz)
language plpgsql security definer
set search_path = public
as $$
begin
  if not can_view_analytics() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query
  select * from (
    select 'signup'::text, coalesce(u.name, u.email, '新用户'), u.created_at from users u
    union all select 'service',    coalesce(s.title,'服务'),   s.created_at from services s
    union all select 'inquiry',    coalesce(i.category_id,'需求'), i.created_at from inquiries i
    union all select 'order',      coalesce(o.title,'成交') || case when o.amount is not null then ' · $'||o.amount else '' end, o.created_at from orders o
    union all select 'community',  coalesce(c.title,'论坛贴'), c.created_at from community_posts c
    union all select 'job',        coalesce(j.title,'招聘'),   j.created_at from jobs j
    union all select 'secondhand', coalesce(sh.title,'闲置'),  sh.created_at from secondhand sh
  ) f(kind, label, at)
  order by at desc nulls last
  limit greatest(1, least(p_limit, 100));
end;
$$;

revoke all on function public.can_view_analytics() from public, anon;
grant execute on function public.can_view_analytics() to authenticated;
