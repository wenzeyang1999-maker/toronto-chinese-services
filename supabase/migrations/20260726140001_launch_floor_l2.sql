-- 启动期福利：全员生效等级保底 L2（黄金）。
--   L3（后台授予）保持 L3；其余（L1 / 试用到期 / 存量老用户）一律按 L2 计。
--   覆盖：存量用户、试用到期用户、以后新增用户，全部自动 ≥ L2。
--
-- ⚠️ 收费上线时如何回落真实等级：把下面 CASE 的 ELSE 'L2' 改回 ELSE 'L1' 即可
--   （即恢复 20260713120003 的原逻辑），无需改其他地方。

CREATE OR REPLACE FUNCTION public.effective_member_level(p_uid uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    -- L3 需在有效期内才算 L3，否则并入下方保底
    WHEN u.membership_level = 'L3'
     AND (u.membership_expires_at IS NULL OR u.membership_expires_at > now())
    THEN 'L3'
    -- 启动期：所有其他人保底 L2（收费上线时把这里改回 'L1'）
    ELSE 'L2'
  END
  FROM public.users u
  WHERE u.id = p_uid
$$;
