-- 老板改主意：每类"同时在架"上限调整为
--   L1 普通 = 1   ·   L2 黄金 = 3   ·   L3 至尊 = 10
-- 只改档位映射，触发器/表挂载不变。删帖/关闭后名额自动释放；编辑(UPDATE)不受限。

CREATE OR REPLACE FUNCTION public.enforce_member_quota()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_owner_col TEXT := TG_ARGV[0];
  v_filter    TEXT := TG_ARGV[1];
  v_label     TEXT := TG_ARGV[2];
  v_owner     UUID;
  v_level     TEXT;
  v_cap       INT;
  v_count     INT;
  v_is_admin  BOOLEAN;
BEGIN
  v_owner := (to_jsonb(NEW) ->> v_owner_col)::uuid;
  IF v_owner IS NULL THEN
    RETURN NEW;   -- 匿名/系统行不限额
  END IF;

  -- 管理员不受限
  SELECT (role = 'admin') INTO v_is_admin FROM public.users WHERE id = v_owner;
  IF COALESCE(v_is_admin, false) THEN
    RETURN NEW;
  END IF;

  v_level := public.effective_member_level(v_owner);
  v_cap := CASE v_level WHEN 'L3' THEN 10 WHEN 'L2' THEN 3 ELSE 1 END;

  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE %I = $1 AND (%s)',
    TG_TABLE_NAME, v_owner_col, v_filter
  ) INTO v_count USING v_owner;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION
      '% 会员最多同时发布 % 条%，你已达上限。请先删除/关闭已有的，或升级会员',
      CASE v_level WHEN 'L3' THEN '至尊' WHEN 'L2' THEN '黄金' ELSE '普通' END,
      v_cap, v_label
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
