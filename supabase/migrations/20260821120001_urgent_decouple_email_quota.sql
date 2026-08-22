-- ─── 紧急需求:发帖不限,邮件按人按天限额 ──────────────────────────────────────
-- 背景:一条紧急单做两件事 —— ① 给所有在线商家实时弹窗(Supabase realtime,免费)
--   ② 给最匹配前 5 家发邮件(烧 Brevo 额度)。原来「每人每天 1 条」的发帖硬限制
--   顺带把免费的弹窗也禁了,体验差。改为:发帖不限制(弹窗每次都触发),把成本控制
--   挪到邮件层 —— 每人每天最多 3 轮紧急邮件(每轮≤5 家=最多 15 封/人/天),超出当天
--   只弹窗不发邮件。派单/站内通知不受影响。

-- 1) 去掉发帖硬限制(触发器 + 函数)
drop trigger if exists trg_daily_urgent_limit on public.inquiries;
drop function if exists public.enforce_daily_urgent_limit();

-- 2) 紧急邮件事件流水(仅记账,service_role 经 RPC 写入;开 RLS 不放策略=客户端不可直连)
create table if not exists public.urgent_email_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists urgent_email_events_user_day_idx
  on public.urgent_email_events (user_id, created_at desc);
alter table public.urgent_email_events enable row level security;

-- 3) 原子「领取一次紧急邮件配额」:当天(多伦多自然日)已达 p_limit 轮则返回 false,
--    否则记一笔并返回 true。派邮件前调用,只有 true 才真正发邮件。
create or replace function public.claim_urgent_email_quota(p_user uuid, p_limit int default 3)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  today_count int;
begin
  select count(*) into today_count
  from public.urgent_email_events
  where user_id = p_user
    and (created_at at time zone 'America/Toronto')::date
        = (now() at time zone 'America/Toronto')::date;
  if today_count >= p_limit then
    return false;
  end if;
  insert into public.urgent_email_events (user_id) values (p_user);
  return true;
end;
$$;

revoke all on function public.claim_urgent_email_quota(uuid, int) from public, anon, authenticated;
