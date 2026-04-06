-- ─── Orphan User Fix Tool ─────────────────────────────────────────────────────
-- 用途：修复 auth.users 和 public.users UUID 不匹配的问题
-- 场景：用户删除了 public.users 行后重新注册，导致新 UUID 没有对应的 profile 行
--
-- 用法：
--   Step 1 — 先跑「诊断」部分，看看有没有不匹配的用户
--   Step 2 — 如果有问题，跑「自动修复」部分
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Step 1: 诊断 ─────────────────────────────────────────────────────────────

-- 1a. 在 auth.users 里有账号，但 public.users 里没有对应行的用户
--     （这些人可以登录但看不到自己的 profile，查询会返回 406）
SELECT
  a.id          AS auth_id,
  a.email,
  a.created_at  AS registered_at
FROM auth.users a
LEFT JOIN public.users u ON u.id = a.id
WHERE u.id IS NULL
ORDER BY a.created_at DESC;


-- 1b. 在 public.users 里有行，但 auth.users 里没有对应账号的"幽灵行"
--     （账号已删除但 profile 数据残留）
SELECT
  u.id,
  u.name,
  u.email,
  u.membership_level,
  u.membership_expires_at
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
WHERE a.id IS NULL
ORDER BY u.created_at DESC;


-- ── Step 2: 自动修复 ──────────────────────────────────────────────────────────
-- 处理两种情况：
--   A. auth 有新 UUID，public.users 完全没有这个邮箱 → 直接 INSERT
--   B. auth 有新 UUID，public.users 有同邮箱的老行（UUID 不同）→ 先删老行再 INSERT

-- Case B：用 CTE 原子性地把老行替换为新 UUID（保留原有数据）
WITH orphan_auth AS (
  -- 找到有 auth 账号但 public.users 里没有对应 UUID 的用户
  SELECT a.id AS new_id, a.email, a.raw_user_meta_data
  FROM auth.users a
  LEFT JOIN public.users u ON u.id = a.id
  WHERE u.id IS NULL
),
old_rows AS (
  -- 删掉同邮箱的老行，保留数据
  DELETE FROM public.users
  WHERE email IN (SELECT email FROM orphan_auth)
  RETURNING id AS old_id, name, email, role,
            membership_level, membership_expires_at,
            wechat, social_links, bio, avatar_url
)
INSERT INTO public.users (id, name, email, role, referral_code,
                          membership_level, membership_expires_at,
                          wechat, social_links, bio, avatar_url)
SELECT
  o.new_id,
  COALESCE(r.name, COALESCE(o.raw_user_meta_data->>'name', split_part(o.email, '@', 1))),
  o.email,
  COALESCE(r.role, 'user'),
  upper(substr(md5(o.new_id::text), 1, 7)),
  COALESCE(r.membership_level, 'L1'),
  r.membership_expires_at,
  r.wechat,
  r.social_links,
  r.bio,
  r.avatar_url
FROM orphan_auth o
LEFT JOIN old_rows r ON r.email = o.email
ON CONFLICT (id) DO NOTHING;

-- 查看修复结果
SELECT
  u.id,
  u.name,
  u.email,
  u.membership_level,
  u.created_at
FROM public.users u
JOIN auth.users a ON a.id = u.id
ORDER BY u.created_at DESC
LIMIT 20;
