-- ─── 防批量抓取服务商联系方式 ─────────────────────────────────────────────────
-- get_contact 之前无限流:任一登录账号可循环枚举、把全平台服务商电话/微信撸走。
-- 加「每人每天最多看 30 个【不同】服务商联系方式」;重复看同一个不计数(不影响正常用户)。
-- 记录按多伦多自然日。自己/管理员不受限。

create table if not exists public.contact_views (
  viewer_id  uuid not null references public.users(id) on delete cascade,
  target_id  uuid not null references public.users(id) on delete cascade,
  viewed_on  date not null default (now() at time zone 'America/Toronto')::date,
  primary key (viewer_id, target_id, viewed_on)
);
alter table public.contact_views enable row level security;  -- 仅 SECURITY DEFINER 经 get_contact 写,客户端不可直连

create or replace function public.get_contact(p_target uuid)
returns table(phone text, wechat text, email text)
language plpgsql stable security definer
set search_path to 'public'
as $function$
declare
  v_ok    boolean;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_cnt   int;
begin
  if auth.uid() is null or p_target is null then return; end if;

  select
       p_target = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.services s where s.provider_id = p_target and s.is_available = true)
    or exists (select 1 from public.conversations c
                where (c.client_id = auth.uid() and c.provider_id = p_target)
                   or (c.provider_id = auth.uid() and c.client_id = p_target))
  into v_ok;
  if not v_ok then return; end if;

  -- 限流(仅对「看别人」的普通用户;自己/管理员跳过)
  if p_target <> auth.uid() and not public.is_admin() then
    -- 今天没看过这个 target 才计入;已看过则免费复看
    if not exists (
      select 1 from public.contact_views
       where viewer_id = auth.uid() and target_id = p_target and viewed_on = v_today
    ) then
      select count(*) into v_cnt
        from public.contact_views
       where viewer_id = auth.uid() and viewed_on = v_today;
      if v_cnt >= 30 then
        return;  -- 当天已看满 30 个不同服务商 → 不再返回联系方式
      end if;
      insert into public.contact_views(viewer_id, target_id, viewed_on)
        values (auth.uid(), p_target, v_today)
        on conflict do nothing;
    end if;
  end if;

  return query
    select u.phone::text, u.wechat::text, u.email::text
      from public.users u where u.id = p_target;
end $function$;
