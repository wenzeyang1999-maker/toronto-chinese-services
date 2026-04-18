-- ─── Auth ↔ Public Users 同步修复脚本 ────────────────────────────────────────
-- 处理三种不同步情况：
--   1. public.users 有行但 auth.users 没有（孤儿行，用户已被彻底删除）
--   2. auth.users 有账号但 public.users 没有对应行（trigger 失败，需要补插）
--   3. 同一 email，两边 UUID 不一样（删号重注册，旧行残留）
--
-- 安全：全部用 DO $$ 包裹，每一步先打印诊断，再执行修复。
-- 在 Supabase SQL Editor 用 service role 跑，可重复执行。
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. 诊断：找出所有不同步的账号 ────────────────────────────────────────────
SELECT
  'case 1: orphan in public.users (no auth row)' AS issue,
  u.id, u.email
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
WHERE a.id IS NULL

UNION ALL

SELECT
  'case 2: auth exists but no public.users row' AS issue,
  a.id, a.email
FROM auth.users a
LEFT JOIN public.users u ON u.id = a.id
WHERE u.id IS NULL

UNION ALL

SELECT
  'case 3: same email, different UUID (stale row)' AS issue,
  u.id AS public_id, u.email
FROM public.users u
JOIN auth.users a ON a.email = u.email AND a.id <> u.id;


-- ── 2. 修复 Case 1：删除 public.users 中的孤儿行（auth 已不存在的账号）─────
DO $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users a WHERE a.id = u.id
  )
  -- 保护：只删那些 email 在 auth 里也找不到的，避免误删 case 3
  AND NOT EXISTS (
    SELECT 1 FROM auth.users a WHERE a.email = u.email
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Case 1 fixed: deleted % orphan public.users row(s)', deleted_count;
END $$;


-- ── 3. 修复 Case 3：同 email 不同 UUID → 删旧行，保留 auth 的 UUID ──────────
DO $$
DECLARE
  fixed_count INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT a.id AS auth_id, u.id AS old_id, a.email
    FROM auth.users a
    JOIN public.users u ON u.email = a.email AND u.id <> a.id
  LOOP
    -- 删除 UUID 错误的旧行（关联数据会因 ON DELETE CASCADE 自动处理）
    DELETE FROM public.users WHERE id = rec.old_id;

    -- 插入正确的行
    INSERT INTO public.users (id, name, email, role, referral_code)
    SELECT
      rec.auth_id,
      COALESCE(a.raw_user_meta_data->>'name', '用户'),
      a.email,
      'user',
      public.generate_referral_code()
    FROM auth.users a
    WHERE a.id = rec.auth_id
    ON CONFLICT (id) DO NOTHING;

    fixed_count := fixed_count + 1;
    RAISE NOTICE 'Case 3 fixed: email=%, old_id=%, new_id=%', rec.email, rec.old_id, rec.auth_id;
  END LOOP;

  RAISE NOTICE 'Case 3 total fixed: %', fixed_count;
END $$;


-- ── 4. 修复 Case 2：auth 有但 public 没有 → 补插行 ───────────────────────────
DO $$
DECLARE
  inserted_count INT;
BEGIN
  INSERT INTO public.users (id, name, email, role, referral_code)
  SELECT
    a.id,
    COALESCE(a.raw_user_meta_data->>'name', '用户'),
    a.email,
    'user',
    public.generate_referral_code()
  FROM auth.users a
  LEFT JOIN public.users u ON u.id = a.id
  WHERE u.id IS NULL
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Case 2 fixed: inserted % missing public.users row(s)', inserted_count;
END $$;


-- ── 5. 修复 referral_code 为 null 的行（所有人）────────────────────────────
UPDATE public.users
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;


-- ── 6. 验证：跑完后应该全部返回 0 ────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
    AS orphan_public_rows,
  (SELECT COUNT(*) FROM auth.users a LEFT JOIN public.users u ON u.id = a.id WHERE u.id IS NULL)
    AS missing_public_rows,
  (SELECT COUNT(*) FROM public.users u JOIN auth.users a ON a.email = u.email AND a.id <> u.id)
    AS mismatched_uuid_rows,
  (SELECT COUNT(*) FROM public.users WHERE referral_code IS NULL)
    AS null_referral_codes;
