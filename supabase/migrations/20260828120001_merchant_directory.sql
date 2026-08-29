-- ─── 商家目录:统一展示「已注册服务商」+「网上收录待认领商家」──────────────────
-- 冷启动填充:平台没有独立服务商角色,展示分三态:
--   在线接单(is_online) / 暂未上线(注册但离线) / 待认领(网上收录、尚未注册)。
-- directory_merchants = 我们从网上收集录入的公开商家资料,可被本人注册后「认领」。

create table if not exists public.directory_merchants (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category_id  text,
  area         text,
  city         text,
  phone        text,          -- 仅后台可见,不进公开展示(防抓取)
  wechat       text,          -- 同上
  avatar_url   text,
  bio          text,
  source_url   text,          -- 收录来源(小红书/大众点评/官网等)
  lat          double precision,
  lng          double precision,
  is_published boolean not null default true,
  claimed_by   uuid references public.users(id) on delete set null,
  claimed_at   timestamptz,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists directory_merchants_unclaimed_idx
  on public.directory_merchants (is_published, claimed_by, created_at desc);

alter table public.directory_merchants enable row level security;

-- 公众只读「已发布且未被认领」的;后台(admin/boss)可读全部。
drop policy if exists dm_public_read on public.directory_merchants;
create policy dm_public_read on public.directory_merchants
  for select using (is_published and claimed_by is null);

drop policy if exists dm_staff_read on public.directory_merchants;
create policy dm_staff_read on public.directory_merchants
  for select using (can_view_analytics());

-- 只有 admin/boss 能录入/改/删。
drop policy if exists dm_staff_write on public.directory_merchants;
create policy dm_staff_write on public.directory_merchants
  for all using (can_view_analytics()) with check (can_view_analytics());

-- ① 平台实时数据(公开,首页展示)──────────────────────────────────────────────
create or replace function public.platform_stats()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'users_total',        (select count(*) from users),
    'providers_total',    (select count(*) from users u
                            where u.role = 'user'
                              and ( u.business_verified
                                 or coalesce(array_length(u.skill_tags,1),0) > 0
                                 or (u.bio is not null and u.bio <> '')
                                 or exists(select 1 from services s
                                            where s.provider_id = u.id and s.deleted_at is null) )),
    'online_total',       (select count(*) from users where is_online is true),
    'directory_total',    (select count(*) from directory_merchants
                            where is_published and claimed_by is null),
    'generated_at',       now()
  );
$$;

revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon, authenticated;

-- ② 统一商家橱窗(公开,不含联系方式)──────────────────────────────────────────
-- 三态:online(在线接单) / offline(暂未上线) / unclaimed(待认领)。
create or replace function public.merchant_showcase(p_limit int default 24)
returns table(
  source text, id uuid, name text, avatar_url text, bio text,
  category_id text, area text, status text, verified boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with reg as (
    select
      'user'::text as source, u.id, coalesce(u.name,'商家') as name,
      u.avatar_url, u.bio,
      (select s.category_id from services s
        where s.provider_id = u.id and s.deleted_at is null
        order by s.created_at desc limit 1) as category_id,
      null::text as area,
      case when u.is_online then 'online' else 'offline' end as status,
      u.business_verified as verified,
      u.is_online, u.last_seen_at, u.created_at
    from users u
    where u.role = 'user'
      and ( u.business_verified
         or coalesce(array_length(u.skill_tags,1),0) > 0
         or (u.bio is not null and u.bio <> '')
         or u.avatar_url is not null
         or exists(select 1 from services s where s.provider_id = u.id and s.deleted_at is null) )
  ),
  dir as (
    select
      'directory'::text as source, d.id, d.name, d.avatar_url, d.bio,
      d.category_id, d.area, 'unclaimed'::text as status, false as verified,
      false as is_online, null::timestamptz as last_seen_at, d.created_at
    from directory_merchants d
    where d.is_published and d.claimed_by is null
  )
  select source, id, name, avatar_url, bio, category_id, area, status, verified
  from (select * from reg union all select * from dir) m
  order by
    case status when 'online' then 0 when 'offline' then 1 else 2 end,
    is_online desc, verified desc, last_seen_at desc nulls last, created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.merchant_showcase(int) from public;
grant execute on function public.merchant_showcase(int) to anon, authenticated;

-- ③ 认领收录商家 ──────────────────────────────────────────────────────────────
-- 登录用户认领一条 directory 记录 → 绑定到本人;资料回填到用户名片(仅填空档)。
create or replace function public.claim_merchant(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row directory_merchants%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from directory_merchants
   where id = p_id and is_published and claimed_by is null
   for update;
  if not found then
    raise exception 'merchant_unavailable' using errcode = 'no_data_found';
  end if;

  update directory_merchants
     set claimed_by = v_uid, claimed_at = now()
   where id = p_id;

  -- 回填用户名片空档(不覆盖用户已填内容)。
  update users u set
    name       = coalesce(nullif(u.name,''), v_row.name),
    avatar_url = coalesce(u.avatar_url, v_row.avatar_url),
    bio        = coalesce(nullif(u.bio,''), v_row.bio),
    phone      = coalesce(nullif(u.phone,''), v_row.phone),
    wechat     = coalesce(nullif(u.wechat,''), v_row.wechat),
    updated_at = now()
  where u.id = v_uid;

  return jsonb_build_object('ok', true, 'name', v_row.name);
end;
$$;

revoke all on function public.claim_merchant(uuid) from public, anon;
grant execute on function public.claim_merchant(uuid) to authenticated;
