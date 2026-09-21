-- ─── 后台错误告警 ─────────────────────────────────────────────────────────────
-- 关键后台函数出硬错(如审核模型下线、额度用光)时记录 + 通知 admin/boss。
-- 节流:同一 (source, code) 60 分钟内只告警一次,避免故障期刷屏。

create table if not exists public.error_events (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,           -- 来源函数,如 'moderate-content'
  code        text not null,           -- 错误码,如 'groq_vision_404'
  message     text,                    -- 详情
  severity    text not null default 'error',
  created_at  timestamptz not null default now(),
  notified_at timestamptz              -- 已告警的时间(节流用)
);
create index if not exists error_events_source_code_idx on public.error_events (source, code, created_at desc);

alter table public.error_events enable row level security;
drop policy if exists err_staff_read on public.error_events;
create policy err_staff_read on public.error_events for select using (can_view_analytics());

-- 记录一条错误;若该 (source,code) 近 60 分钟未告警过 → 给 admin/boss 写站内信,
-- 并返回 {notified, admins:[{id,email}]} 供调用方发邮件。
create or replace function public.report_error(p_source text, p_code text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent boolean;
  v_admins jsonb;
begin
  insert into error_events(source, code, message) values (p_source, p_code, left(coalesce(p_message,''), 2000));

  -- 60 分钟内是否已就同一 (source,code) 告警过
  select exists(
    select 1 from error_events
    where source = p_source and code = p_code
      and notified_at is not null and notified_at > now() - interval '60 minutes'
  ) into v_recent;

  if v_recent then
    return jsonb_build_object('notified', false);
  end if;

  -- 标记本轮已告警
  update error_events set notified_at = now()
   where id = (select id from error_events where source=p_source and code=p_code order by created_at desc limit 1);

  -- 给所有 admin/boss 写站内信
  insert into notifications(recipient_id, type, title, body, link_url, metadata)
  select u.id, 'admin_system_error',
         '⚠️ 后台告警:' || p_source,
         '错误码 ' || p_code || coalesce(' · ' || left(p_message, 200), ''),
         '/dashboard',
         jsonb_build_object('source', p_source, 'code', p_code)
  from users u where u.role in ('admin','boss');

  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email)), '[]'::jsonb)
    into v_admins
  from users u where u.role in ('admin','boss');

  return jsonb_build_object('notified', true, 'admins', v_admins);
end;
$$;

revoke all on function public.report_error(text, text, text) from public, anon;
grant execute on function public.report_error(text, text, text) to authenticated, service_role;
