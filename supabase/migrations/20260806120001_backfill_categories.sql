-- ─── 补齐 categories 表缺失的类目 ─────────────────────────────────────────────
-- 根因：services.category_id 有外键 → categories(id)，但 categories 表只建了最初
-- 7 个（moving/cleaning/ride/renovation/cashwork/food/other），而前端 categories.ts
-- 已扩到 23 个。发布 tax(报税)/legal/... 等 16 个新类目时插入 services 会违反外键：
--   insert or update on table "services" violates foreign key constraint ...
-- 这里把前端已有、DB 缺失的 16 个类目补进去（label 沿用现有「找X」浏览风格）。
-- 幂等：ON CONFLICT DO NOTHING，重复执行安全；已有 7 行不受影响。

INSERT INTO public.categories (id, label, description, image_path, sort_order) VALUES
  ('tax',         '找报税',     '个人/公司报税、退税、税务规划',   '/images/categories/tax.svg',          7),
  ('legal',       '找法律',     '律师咨询、合同、劳工、家庭法',     '/images/categories/legal.svg',        8),
  ('immigration', '找移民',     '签证、PR申请、入籍、移民顾问',     '/images/categories/immigration.svg',  9),
  ('tutoring',    '找补课',     '学科补习、语言培训、才艺教学',     '/images/categories/tutoring.svg',    10),
  ('beauty',      '找美容美发', '剪发、美甲、化妆、睫毛、美容',     '/images/categories/beauty.svg',      11),
  ('tcm',         '找中医推拿', '中医、针灸、推拿、拔罐、按摩',     '/images/categories/tcm.svg',         12),
  ('pet',         '找宠物',     '宠物美容、遛狗、寄养、训练',       '/images/categories/pet.svg',         13),
  ('photo',       '找摄影',     '人像、婚礼、活动、证件照摄影',     '/images/categories/photo.svg',       14),
  ('translation', '找翻译',     '中英文翻译、口译、文件认证',       '/images/categories/translation.svg', 15),
  ('it',          '找IT维修',   '电脑维修、网络、建站、数据恢复',   '/images/categories/it.svg',          16),
  ('driving',     '找驾校',     '驾驶培训、陪练、考试辅导',         '/images/categories/driving.svg',     17),
  ('lawn',        '找园艺除雪', '割草、除雪、园艺、树木修剪',       '/images/categories/lawn.svg',        18),
  ('childcare',   '找育儿保姆', '月嫂、保姆、育儿、接送孩子',       '/images/categories/childcare.svg',   19),
  ('insurance',   '找保险',     '人寿、医疗、车险、房屋保险',       '/images/categories/insurance.svg',   20),
  ('handyman',    '找综合维修', '小修小补、家电维修、家具组装',     '/images/categories/handyman.svg',    21),
  ('junk',        '找垃圾清运', '大件垃圾、旧家具、建筑废料清运',   '/images/categories/junk.svg',        22)
ON CONFLICT (id) DO NOTHING;

-- 让「其他」保持排序最后
UPDATE public.categories SET sort_order = 99 WHERE id = 'other';
