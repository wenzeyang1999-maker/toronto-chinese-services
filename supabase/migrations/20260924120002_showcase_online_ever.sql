-- ─── 商家展示:「曾经上线过 = 在线」(冷启动,暂时)────────────────────────────
-- 配合 20260924120001(停自动下线 cron + 回填),把商家展示的「在线」判定也从
-- 「is_online 且最近 2 小时活跃」放宽为「只要 is_online」。这样上过一次线的商家
-- 在首页「猜你喜欢」/商家展示里持续显示「在线接单」,直到自己手动下线。
-- 恢复严格口径时,把 fresh_online 改回 (is_online and last_seen_at > now()-interval '2 hours')。
CREATE OR REPLACE FUNCTION public.merchant_showcase(p_limit integer DEFAULT 24)
 RETURNS TABLE(source text, id uuid, name text, avatar_url text, bio text, category_id text, area text, status text, verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with reg as (
    select
      'user'::text as source, u.id, coalesce(u.name,'商家') as name,
      u.avatar_url, u.bio,
      (select s.category_id from services s
        where s.provider_id = u.id and s.deleted_at is null
        order by s.created_at desc limit 1) as category_id,
      null::text as area,
      coalesce(u.is_online, false) as fresh_online,   -- 冷启动:曾上线过即在线(去掉2h新鲜度)
      u.business_verified as verified, u.last_seen_at, u.created_at
    from users u
    where u.role = 'user'
      and exists (select 1 from auth.users a where a.id = u.id)
      and ( u.business_verified
         or coalesce(array_length(u.skill_tags,1),0) > 0
         or (u.bio is not null and u.bio <> '')
         or u.avatar_url is not null
         or exists(select 1 from services s where s.provider_id = u.id and s.deleted_at is null)
         or u.is_online )                       -- 开过接单模式=商家 → 都进
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
$function$
