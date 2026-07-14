-- ─── 会员等级发布额度（每类"同时在架"上限）─────────────────────────────────
-- 每个内容类目，按发布者的有效会员等级限制同时存在的条数：
--   L1 普通 = 3   ·   L2 黄金 = 10   ·   L3 至尊 = 20
-- 删除/关闭/售出后名额自动释放（只数"在架/活跃"的行）。管理员不受限。
-- 在 DB 层用 BEFORE INSERT 触发器强制，直连 API 也绕不过。与既有防刷限流叠加生效。

-- 有效等级：过期或未升级都按 L1；L2/L3 未设过期时间视为永久有效。
CREATE OR REPLACE FUNCTION public.effective_member_level(p_uid uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    WHEN u.membership_level IN ('L2', 'L3')
     AND (u.membership_expires_at IS NULL OR u.membership_expires_at > now())
    THEN u.membership_level
    ELSE 'L1'
  END
  FROM public.users u
  WHERE u.id = p_uid
$$;

-- 通用额度触发器：TG_ARGV = (owner_col, active_filter_sql, type_label)
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
  v_cap := CASE v_level WHEN 'L3' THEN 20 WHEN 'L2' THEN 10 ELSE 3 END;

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

-- 挂到各内容表（owner 列 + "在架/活跃"过滤 + 类目名）
DROP TRIGGER IF EXISTS trg_quota_services ON public.services;
CREATE TRIGGER trg_quota_services BEFORE INSERT ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota('provider_id', 'deleted_at IS NULL', '服务');

DROP TRIGGER IF EXISTS trg_quota_community_posts ON public.community_posts;
CREATE TRIGGER trg_quota_community_posts BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota('author_id', 'true', '帖子');

DROP TRIGGER IF EXISTS trg_quota_inquiries ON public.inquiries;
CREATE TRIGGER trg_quota_inquiries BEFORE INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota('user_id', $$status NOT IN ('closed','completed','cancelled')$$, '需求');

DROP TRIGGER IF EXISTS trg_quota_secondhand ON public.secondhand;
CREATE TRIGGER trg_quota_secondhand BEFORE INSERT ON public.secondhand
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota('seller_id', 'COALESCE(is_active,true) AND NOT COALESCE(is_sold,false)', '二手');

DROP TRIGGER IF EXISTS trg_quota_jobs ON public.jobs;
CREATE TRIGGER trg_quota_jobs BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota('poster_id', 'COALESCE(is_active,true)', '招聘');

DROP TRIGGER IF EXISTS trg_quota_properties ON public.properties;
CREATE TRIGGER trg_quota_properties BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota('poster_id', 'COALESCE(is_active,true)', '房源');

DROP TRIGGER IF EXISTS trg_quota_events ON public.events;
CREATE TRIGGER trg_quota_events BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_quota('poster_id', 'COALESCE(is_active,true)', '活动');
