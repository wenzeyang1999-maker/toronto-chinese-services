-- ─── 统一商家搜索(注册服务商 + 收录商家)────────────────────────────────────
-- 帖子少时,让「符合关键词的商家」也作为搜索结果入口(点进去是主页/详情)。
-- 不含联系方式;收录商家电话仍只在其详情页显示。按 技能标签/关键词/名称/简介 匹配。
create or replace function public.search_merchants_by_keyword(kw text)
returns table(
  source text, id uuid, name text, avatar_url text, bio text,
  area text, skill_tags text[], status text, verified boolean, is_online boolean
)
language sql
security definer
set search_path = public
stable
as $$
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
$$;

revoke all on function public.search_merchants_by_keyword(text) from public;
grant execute on function public.search_merchants_by_keyword(text) to anon, authenticated;
