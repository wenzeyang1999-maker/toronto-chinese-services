-- ─── Demo service_requests for "找客户" tab testing ──────────────────────────
-- Seeds 8 demo users (留学生 / 工签 style) and 10 realistic service requests.
-- All emails end in @tcs-demo.local so they're easy to remove later:
--   DELETE FROM service_requests WHERE user_id IN
--     (SELECT id FROM users WHERE email LIKE '%@tcs-demo.local');
--   DELETE FROM users WHERE email LIKE '%@tcs-demo.local';

-- ── 1. Demo users ────────────────────────────────────────────────────────────
INSERT INTO public.users (id, name, email, role, created_at)
VALUES
  ('a0000001-0000-0000-0000-000000000001', '小林',     'demo1@tcs-demo.local', 'user', NOW() - INTERVAL '20 days'),
  ('a0000001-0000-0000-0000-000000000002', 'Lucas Zhang','demo2@tcs-demo.local', 'user', NOW() - INTERVAL '15 days'),
  ('a0000001-0000-0000-0000-000000000003', '阿May',    'demo3@tcs-demo.local', 'user', NOW() - INTERVAL '12 days'),
  ('a0000001-0000-0000-0000-000000000004', '小川',     'demo4@tcs-demo.local', 'user', NOW() - INTERVAL '8 days'),
  ('a0000001-0000-0000-0000-000000000005', 'Cici',     'demo5@tcs-demo.local', 'user', NOW() - INTERVAL '7 days'),
  ('a0000001-0000-0000-0000-000000000006', '王同学',   'demo6@tcs-demo.local', 'user', NOW() - INTERVAL '5 days'),
  ('a0000001-0000-0000-0000-000000000007', '阿伟',     'demo7@tcs-demo.local', 'user', NOW() - INTERVAL '4 days'),
  ('a0000001-0000-0000-0000-000000000008', 'Emma',     'demo8@tcs-demo.local', 'user', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- ── 2. Demo service requests ─────────────────────────────────────────────────
INSERT INTO public.service_requests
  (user_id, title, description, category, area, city, lat, lng, budget, expires_at, status, created_at)
VALUES
  -- 搬家类
  (
    'a0000001-0000-0000-0000-000000000001',
    '6/1 搬家求帮手，从 Scarborough 到北约克',
    '一房一厅的东西，主要是床垫、衣物、几个箱子。需要面包车 + 1-2 人帮忙搬。希望周六上午能完成。',
    'moving', 'North York 北约克', 'Toronto', 43.7615, -79.4111,
    '$80-120 全程', NOW() + INTERVAL '7 days', 'open', NOW() - INTERVAL '20 hours'
  ),
  (
    'a0000001-0000-0000-0000-000000000002',
    '下周三搬到 Markham，找有 cube van 的师傅',
    '从 downtown 一房搬到 Markham 的两房，家具不多，主要 IKEA 拆装好的。需要 cube van 一趟。',
    'moving', 'Markham 万锦', 'Toronto', 43.8561, -79.3370,
    '$150 左右', NOW() + INTERVAL '10 days', 'open', NOW() - INTERVAL '2 days'
  ),

  -- 接送类
  (
    'a0000001-0000-0000-0000-000000000003',
    '5/25 凌晨 1 点接机，YYZ → North York',
    '从 Pearson Terminal 1 接机，2 个大箱子。希望司机能耐心等下飞机的时间。',
    'ride', 'North York 北约克', 'Toronto', 43.7724, -79.4109,
    '$60-80', NOW() + INTERVAL '4 days', 'open', NOW() - INTERVAL '6 hours'
  ),
  (
    'a0000001-0000-0000-0000-000000000004',
    '周末 Niagara 一日游包车',
    '周六或周日，4 个人，从 Downtown 出发去 Niagara Falls 一日游，下午回来。希望司机国语 OK 沟通方便。',
    'ride', 'Downtown Toronto 多伦多市中心', 'Toronto', 43.6532, -79.3832,
    '$200 包整天', NOW() + INTERVAL '14 days', 'open', NOW() - INTERVAL '1 day'
  ),

  -- 保洁类
  (
    'a0000001-0000-0000-0000-000000000005',
    '退租前深度清洁，一室一厅',
    'Markham 一室一厅，月底前要做退租清洁，需要厨房+卫生间深度清，地毯吸尘。希望师傅有 move-out cleaning 经验。',
    'cleaning', 'Markham 万锦', 'Toronto', 43.8770, -79.2630,
    '$150 一次', NOW() + INTERVAL '6 days', 'open', NOW() - INTERVAL '10 hours'
  ),
  (
    'a0000001-0000-0000-0000-000000000006',
    '每两周定期保洁，两房两卫',
    'Mississauga condo，每两周一次定期清洁，重点是厨房和两个卫生间。希望长期合作，能讲国语优先。',
    'cleaning', 'Mississauga 密西沙加', 'Toronto', 43.5890, -79.6441,
    '$80/次 长期', NOW() + INTERVAL '20 days', 'open', NOW() - INTERVAL '3 days'
  ),

  -- 现金工 / 杂活
  (
    'a0000001-0000-0000-0000-000000000007',
    '装 IKEA 家具求帮手，2 小时',
    '刚买了一张 IKEA Kallax 书柜 + 床架，自己看不懂说明书。需要有经验的师傅帮忙组装，自带工具。',
    'cashwork', 'Downtown Toronto 多伦多市中心', 'Toronto', 43.6549, -79.3850,
    '$40-60 完工', NOW() + INTERVAL '5 days', 'open', NOW() - INTERVAL '4 hours'
  ),
  (
    'a0000001-0000-0000-0000-000000000008',
    '厨房水龙头漏水，找会修水管的',
    '厨房水龙头底座一直漏水，可能是垫圈坏了。希望有水电经验的师傅来看下，能解决就 OK。',
    'cashwork', 'North York 北约克', 'Toronto', 43.7800, -79.4150,
    '面议', NOW() + INTERVAL '3 days', 'open', NOW() - INTERVAL '12 hours'
  ),

  -- 装修
  (
    'a0000001-0000-0000-0000-000000000001',
    '阳台简单防水 + 重新刷漆',
    '小阳台之前漏水修过，但漆面起皮严重。需要清理 + 防水处理 + 重新刷一遍。面积约 8 平米。',
    'renovation', 'Etobicoke 怡陶碧谷', 'Toronto', 43.6435, -79.5656,
    '$300-500', NOW() + INTERVAL '12 days', 'open', NOW() - INTERVAL '2 days'
  ),

  -- 其他
  (
    'a0000001-0000-0000-0000-000000000004',
    '帮忙报 2025 年个人税，留学生工签',
    '之前是 PGWP，去年开始全职工作。需要靠谱的会计帮忙处理 T4 + 之前学费 credit。希望线上沟通。',
    'other', NULL, 'Toronto', NULL, NULL,
    '$80-120', NOW() + INTERVAL '15 days', 'open', NOW() - INTERVAL '5 days'
  )
ON CONFLICT DO NOTHING;
