-- ─── Admin 后台数据检测 ───────────────────────────────────────────────────────
-- 两个 admin-only RPC:① 汇总指标(注册/活跃/内容/业务流水/GMV)② 实时活动流水 feed。
-- 都用 is_admin() 服务端闸门,非管理员直接报错;聚合在服务端算,只回汇总数,不泄露明细。

-- ① 汇总指标
create or replace function public.admin_backend_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    -- 用户
    'users_total',        (select count(*) from users),
    'users_1d',           (select count(*) from users where created_at > now() - interval '1 day'),
    'users_7d',           (select count(*) from users where created_at > now() - interval '7 days'),
    'users_30d',          (select count(*) from users where created_at > now() - interval '30 days'),
    'dau',                (select count(*) from users where last_seen_at > now() - interval '1 day'),
    'wau',                (select count(*) from users where last_seen_at > now() - interval '7 days'),
    'mau',                (select count(*) from users where last_seen_at > now() - interval '30 days'),
    'online_providers',   (select count(*) from users where is_online is true),
    -- 内容
    'services',           (select count(*) from services),
    'jobs',               (select count(*) from jobs),
    'properties',         (select count(*) from properties),
    'secondhand',         (select count(*) from secondhand),
    'events',             (select count(*) from events),
    'community',          (select count(*) from community_posts),
    -- 业务流水
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

revoke all on function public.admin_backend_metrics() from public, anon;
grant execute on function public.admin_backend_metrics() to authenticated;

-- ② 实时活动流水(最近 N 条:注册/发服务/发帖/需求/成交/招聘/二手,时间倒序)
create or replace function public.admin_activity_feed(p_limit int default 40)
returns table(kind text, label text, at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query
  select * from (
    select 'signup'::text,    coalesce(u.name, u.email, '新用户'),        u.created_at from users u
    union all
    select 'service',         coalesce(s.title, '服务'),                  s.created_at from services s
    union all
    select 'inquiry',         coalesce(i.category_id, '需求'),            i.created_at from inquiries i
    union all
    select 'order',           coalesce(o.title,'成交') || case when o.amount is not null then ' · $'||o.amount else '' end, o.created_at from orders o
    union all
    select 'community',       coalesce(c.title, '论坛贴'),                c.created_at from community_posts c
    union all
    select 'job',             coalesce(j.title, '招聘'),                  j.created_at from jobs j
    union all
    select 'secondhand',      coalesce(sh.title, '闲置'),                 sh.created_at from secondhand sh
  ) f(kind, label, at)
  order by at desc nulls last
  limit greatest(1, least(p_limit, 100));
end;
$$;

revoke all on function public.admin_activity_feed(int) from public, anon;
grant execute on function public.admin_activity_feed(int) to authenticated;
