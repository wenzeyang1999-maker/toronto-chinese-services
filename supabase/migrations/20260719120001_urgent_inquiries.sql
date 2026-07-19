-- ─── 紧急单（加强紧急需求） ──────────────────────────────────────────────────
-- 需求可标记为「紧急」：发给所有「上线接单」的匹配商家（不止 top5），并给正在
-- 用 App 的在线商家实时弹窗提醒。为防滥用，每人每天最多发布 1 个紧急需求。
--
-- 同时新增 contact_mode：
--   providers_contact = 让商家联系你（推：派单给商家，商家主动联系客户，现有流程）
--   self_contact      = 主动联系上线商家（拉：客户直接看在线商家名片墙，自己联系）

alter table public.inquiries
  add column if not exists is_urgent boolean not null default false,
  add column if not exists contact_mode text not null default 'providers_contact'
    check (contact_mode in ('providers_contact', 'self_contact'));

-- 公开需求帖也带 is_urgent —— 在线商家的实时弹窗订阅的是这张（无隐私）表。
alter table public.service_requests
  add column if not exists is_urgent boolean not null default false;

create index if not exists service_requests_urgent_idx
  on public.service_requests (created_at desc)
  where is_urgent;

-- 每人每天（多伦多时区自然日）最多 1 个紧急需求。
create or replace function public.enforce_daily_urgent_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today_count int;
begin
  if new.is_urgent is not true then
    return new;
  end if;
  select count(*) into today_count
  from public.inquiries
  where user_id = new.user_id
    and is_urgent = true
    and (created_at at time zone 'America/Toronto')::date
        = (now() at time zone 'America/Toronto')::date;
  if today_count >= 1 then
    raise exception '每人每天最多发布 1 个紧急需求，请明天再试或改为普通发布'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_daily_urgent_limit on public.inquiries;
create trigger trg_daily_urgent_limit
  before insert on public.inquiries
  for each row execute function public.enforce_daily_urgent_limit();

-- 在线商家的实时弹窗订阅的是 service_requests 的 INSERT —— 确保该表在 realtime
-- 发布中（若已存在则跳过，幂等）。
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'service_requests'
  ) then
    alter publication supabase_realtime add table public.service_requests;
  end if;
end $$;
