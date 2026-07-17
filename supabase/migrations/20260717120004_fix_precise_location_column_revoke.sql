-- ─── 修复 B7 精确坐标列级 REVOKE 失效（HIGH）────────────────────────────────────
-- 20260716120001 用了 `REVOKE SELECT (precise_lat) ... FROM authenticated`，但
-- Postgres 里**表级 SELECT 授权无法被列级 REVOKE 覆盖**——inquiries 从未做过表级
-- REVOKE + 逐列重授，Supabase 默认对 authenticated/anon 授予表级 SELECT，因此那两
-- 列实际仍可被任意登录用户直接 `select precise_lat, precise_lng from inquiries`
-- 读到，绕过 get_inquiry_location 的 owner/录用师傅门控，击穿 B7 隐私承诺。
--
-- 正确写法（与 users 表 20260706120006 一致）：先撤表级 SELECT，再把「除精确坐标
-- 外的所有列」重新授予 authenticated。anon 不重授（inquiries 的 SELECT RLS 需要
-- auth.uid()，匿名本就读不到任何行）。

DO $$
DECLARE cols text;
BEGIN
  REVOKE SELECT ON public.inquiries FROM authenticated;
  REVOKE SELECT ON public.inquiries FROM anon;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'inquiries'
     AND column_name NOT IN ('precise_lat', 'precise_lng');

  EXECUTE format('GRANT SELECT (%s) ON public.inquiries TO authenticated', cols);
END $$;
