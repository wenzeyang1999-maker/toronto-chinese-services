-- 商家展示:①新鲜在线(is_online 且 last_seen<2h)也纳入展示门槛,让在线接单商家即使资料薄也可见;
-- ②status 按 last_seen 新鲜度判定(避免"挂了10小时仍显示在线接单")。
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
      (u.is_online and u.last_seen_at > now() - interval '2 hours') as fresh_online,
      u.business_verified as verified, u.last_seen_at, u.created_at
    from users u
    where u.role = 'user'
      and exists (select 1 from auth.users a where a.id = u.id)
      and ( u.business_verified
         or coalesce(array_length(u.skill_tags,1),0) > 0
         or (u.bio is not null and u.bio <> '')
         or u.avatar_url is not null
         or exists(select 1 from services s where s.provider_id = u.id and s.deleted_at is null)
         or (u.is_online and u.last_seen_at > now() - interval '2 hours') )
  ),
  dir as (
    select
      'directory'::text as source, d.id, d.name, d.avatar_url, d.bio,
      d.category_id, d.area, false as fresh_online, false as verified,
      null::timestamptz as last_seen_at, d.created_at
    from directory_merchants d
    where d.is_published and d.claimed_by is null
  )
  select source, id, name, avatar_url, bio, category_id, area,
         case when fresh_online then 'online'
              when source='directory' then 'unclaimed'
              else 'offline' end as status,
         verified
  from (select * from reg union all select * from dir) m
  order by
    case when fresh_online then 0 when source='directory' then 2 else 1 end,
    verified desc, last_seen_at desc nulls last, created_at desc
  limit greatest(1, least(p_limit, 100));
$function$;
