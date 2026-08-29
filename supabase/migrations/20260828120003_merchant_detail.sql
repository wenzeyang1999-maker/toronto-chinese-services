-- ─── 收录商家详情(帖子页):按 id 返回单条,含公开电话 ────────────────────────
-- 决策:电话只在「商家详情页」显示,列表/橱窗不显示。
-- 做法:关闭公众「直接读表」,前台一律走 RPC —— 列表(merchant_showcase)不含电话,
--       详情(merchant_detail)按单个 id 才返回电话,避免批量抓取。后台(staff)照常可读表。

-- 撤掉公众直接读表策略(showcase / detail 都是 SECURITY DEFINER,不受影响;
-- 后台 dm_staff_read 仍在,admin/boss 可读全表)。
drop policy if exists dm_public_read on public.directory_merchants;

create or replace function public.merchant_detail(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare r public.directory_merchants%rowtype;
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
    'phone',       r.phone,      -- 公开商业电话:仅详情页返回
    'wechat',      r.wechat,
    'website',     r.website,
    'status',      'unclaimed'
  );
end;
$$;

revoke all on function public.merchant_detail(uuid) from public;
grant execute on function public.merchant_detail(uuid) to anon, authenticated;
