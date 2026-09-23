-- 商家可选公开电话:show_phone 开关 + 公开电话 RPC(开启才返回,anon 也可读、不占 get_contact 限流)。
alter table public.users add column if not exists show_phone boolean not null default false;

create or replace function public.provider_public_phone(p_id uuid)
returns text
language sql security definer set search_path = public stable
as $$
  select case when u.show_phone then nullif(u.phone,'') else null end
  from public.users u where u.id = p_id;
$$;
revoke all on function public.provider_public_phone(uuid) from public;
grant execute on function public.provider_public_phone(uuid) to anon, authenticated;
