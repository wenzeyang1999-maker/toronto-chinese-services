-- ─── 收录商家详情:联系方式仅登录可见 ────────────────────────────────────────
-- 未登录(anon)调用只返回公开资料,不返回电话/微信;前端据 contact_locked 显示
-- 「登录后查看联系方式」。既保护商家信息,也引导注册登录。
create or replace function public.merchant_detail(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  r public.directory_merchants%rowtype;
  v_authed boolean := auth.uid() is not null;
begin
  select * into r from public.directory_merchants
   where id = p_id and is_published and claimed_by is null;
  if not found then return null; end if;
  return jsonb_build_object(
    'id',          r.id,
    'name',        r.name,
    'avatar_url',  r.avatar_url,
    'bio',         r.bio,
    'category_id', r.category_id,
    'area',        r.area,
    'languages',   r.languages,
    'keywords',    r.keywords,
    'phone',       case when v_authed then r.phone  else null end,
    'wechat',      case when v_authed then r.wechat else null end,
    'website',     r.website,
    'contact_locked', not v_authed,   -- true = 未登录,前端显示「登录查看」
    'status',      'unclaimed'
  );
end;
$$;

revoke all on function public.merchant_detail(uuid) from public;
grant execute on function public.merchant_detail(uuid) to anon, authenticated;
