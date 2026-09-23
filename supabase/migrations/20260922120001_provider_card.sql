-- 商家名片分享:公开卡片数据(只回展示用字段,不含隐私)。
create or replace function public.provider_card(p_id uuid)
returns jsonb
language sql security definer set search_path = public stable
as $$
  select jsonb_build_object(
    'id',         u.id,
    'name',       coalesce(nullif(u.name,''), '华邻商家'),
    'avatar_url', u.avatar_url,
    'title',      coalesce(nullif(array_to_string((u.skill_tags)[1:3], ' · '), ''), '华人本地服务'),
    'area',       '多伦多及 GTA',
    'verified',   coalesce(u.business_verified, false)
  )
  from users u
  where u.id = p_id and exists (select 1 from auth.users a where a.id = u.id);
$$;
revoke all on function public.provider_card(uuid) from public;
grant execute on function public.provider_card(uuid) to anon, authenticated;
