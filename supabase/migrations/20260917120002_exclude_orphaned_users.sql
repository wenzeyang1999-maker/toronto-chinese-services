-- ─── 注销/孤儿账号不再展示 ────────────────────────────────────────────────────
-- 问题:注销时 auth 登录身份被删,但 public.users 资料行若残留(孤儿),
-- merchant_showcase / 搜索 仍会展示 → 用户误以为该商家还在。
-- 修复:展示/搜索只保留「有对应 auth 登录身份」的注册账号。

create or replace function public.merchant_showcase(p_limit integer default 24)
returns table(source text, id uuid, name text, avatar_url text, bio text, category_id text, area text, status text, verified boolean)
language sql stable security definer set search_path to 'public'
as $function$
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
      and exists (select 1 from auth.users a where a.id = u.id)   -- 排除注销/孤儿账号
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
$function$;

create or replace function public.search_merchants_by_keyword(kw text)
returns table(source text, id uuid, name text, avatar_url text, bio text, area text, skill_tags text[], status text, verified boolean, is_online boolean)
language sql stable security definer set search_path to 'public'
as $function$
  with reg as (
    select
      'user'::text as source, u.id, coalesce(u.name,'商家') as name,
      u.avatar_url, u.bio, null::text as area, u.skill_tags,
      case when u.is_online then 'online' else 'offline' end as status,
      coalesce(u.business_verified,false) as verified,
      coalesce(u.is_online,false) as is_online,
      u.last_seen_at, u.created_at
    from users u
    where kw <> '' and u.role = 'user'
      and exists (select 1 from auth.users a where a.id = u.id)   -- 排除注销/孤儿账号
      and (
        u.name ilike '%'||kw||'%'
        or (u.bio is not null and u.bio ilike '%'||kw||'%')
        or exists (select 1 from unnest(u.skill_tags) t where t ilike '%'||kw||'%')
      )
  ),
  dir as (
    select
      'directory'::text as source, d.id, d.name, d.avatar_url, d.bio,
      d.area, d.keywords as skill_tags, 'unclaimed'::text as status,
      false as verified, false as is_online,
      null::timestamptz as last_seen_at, d.created_at
    from directory_merchants d
    where kw <> '' and d.is_published and d.claimed_by is null
      and (
        d.name ilike '%'||kw||'%'
        or (d.bio is not null and d.bio ilike '%'||kw||'%')
        or exists (select 1 from unnest(d.keywords) t where t ilike '%'||kw||'%')
      )
  )
  select source, id, name, avatar_url, bio, area, skill_tags, status, verified, is_online
  from (select * from reg union all select * from dir) m
  order by
    case status when 'online' then 0 when 'offline' then 1 else 2 end,
    verified desc, is_online desc, last_seen_at desc nulls last, created_at desc
  limit 20;
$function$;
