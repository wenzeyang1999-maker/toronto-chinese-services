-- ─── 注册商名单(admin/boss 数据后台)────────────────────────────────────────
-- 平台没有单独的「服务商」角色 —— 谁算服务商靠「信号」判定:
--   发过服务贴 / 商业认证 / 填了技能标签 / 有头像+简介。
-- 只给 can_view_analytics()(admin/boss)看,含联系方式明细,故服务端闸门。
create or replace function public.admin_provider_list()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_view_analytics() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select
        u.id,
        coalesce(u.name, u.email, '未命名') as name,
        u.phone,
        u.wechat,
        (u.avatar_url is not null)                                      as has_avatar,
        (u.bio is not null and u.bio <> '')                             as has_bio,
        coalesce(array_length(u.skill_tags, 1), 0)                      as skills,
        u.business_verified                                             as verified,
        u.membership_level                                              as level,
        (select count(*) from services s
           where s.provider_id = u.id and s.deleted_at is null)::int    as active_posts,
        (select count(*) from services s where s.provider_id = u.id)::int as total_posts,
        u.created_at,
        u.last_seen_at
      from users u
      where u.role = 'user'
        and (
             u.avatar_url is not null
          or (u.bio is not null and u.bio <> '')
          or coalesce(array_length(u.skill_tags, 1), 0) > 0
          or u.business_verified
          or exists (select 1 from services s where s.provider_id = u.id and s.deleted_at is null)
        )
      order by
        (select count(*) from services s where s.provider_id = u.id and s.deleted_at is null) desc,
        u.business_verified desc,
        coalesce(array_length(u.skill_tags, 1), 0) desc,
        u.created_at desc
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_provider_list() from public, anon;
grant execute on function public.admin_provider_list() to authenticated;
