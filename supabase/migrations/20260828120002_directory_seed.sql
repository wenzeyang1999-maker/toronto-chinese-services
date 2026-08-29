-- ─── 商家收录:补字段(对齐《公开服务商目录录入操作说明》)+ 第一批种子数据 ──────
-- 文档要求字段:业务关键词(搜索核心)、服务语言、官方网站。
alter table public.directory_merchants add column if not exists keywords  text[];
alter table public.directory_merchants add column if not exists languages text;
alter table public.directory_merchants add column if not exists website   text;

-- 第一批 10 家(《平台公开资料收录 · 尚未认领》)。均为公开商业资料,统一未认领。
-- 类别映射到华邻已有 category_id;关键词供后续搜索抓取。去重:同名已存在则跳过。
insert into public.directory_merchants
  (name, category_id, area, phone, bio, languages, keywords, source_url, is_published)
select v.name, v.category_id, v.area, v.phone, v.bio, v.languages, v.keywords, '公开名录（内部收录）', true
from (values
  ('Toronto Unique Moving', 'moving', 'Toronto / Markham / GTA', '647-496-1218',
   '提供多伦多及 GTA 住宅、公寓、办公室搬家,含钢琴搬运,可中文沟通。', '普通话＋粤语',
   array['搬家','华人搬家','公寓搬家','办公室搬家','钢琴搬运','长途搬家']),
  ('Wilcan Logistics', 'moving', 'Toronto / GTA', '416-303-0019',
   '多伦多及 GTA 搬家物流,含国际/长途搬家、包装与公司搬迁,中文服务。', '普通话＋粤语',
   array['搬家','国际搬家','长途搬家','包装','公司搬迁']),
  ('Chinese Handyman', 'handyman', 'Mississauga / Waterloo / Kitchener', '647-821-4635',
   '密西沙加、滑铁卢、基奇纳一带房屋维修与装修,浴室装修、安装,中文服务。', '普通话＋粤语',
   array['Handyman','房屋维修','浴室装修','安装','装修']),
  ('FEIS Home Reno 辉帆装修', 'renovation', 'Toronto / Markham / Richmond Hill / GTA', '416-508-9356',
   '多伦多、万锦、列治文山装修刷墙,厨房、浴室、地下室、地板,中文服务。', '普通话＋粤语',
   array['装修','刷墙','油漆','地下室','厨房','浴室','地板']),
  ('辉诚房屋服务', 'handyman', 'Toronto / GTA', '437-981-2066',
   '多伦多及 GTA 水管管道与房屋维修,通渠、漏水、马桶维修与安装,中文服务。', '中文',
   array['水管','通渠','漏水','马桶维修','房屋维修','安装']),
  ('AnSen 安心家电维修', 'handyman', 'Markham / Scarborough / North York / GTA', '416-278-8668',
   '万锦、士嘉堡、北约克家电维修,冰箱、洗衣机、烘干机、洗碗机、炉灶,中文服务。', '普通话＋粤语',
   array['家电维修','冰箱','洗衣机','烘干机','洗碗机','炉灶']),
  ('Richard 家电维修', 'handyman', 'Toronto / GTA', '647-609-9396',
   '多伦多及 GTA 家电维修,冰箱、洗衣机、烘干机、洗碗机、烤箱,中文服务。', '中文',
   array['家电维修','冰箱','洗衣机','烘干机','洗碗机','烤箱']),
  ('Chinese Art Landscaping', 'lawn', 'GTA', '647-767-0366',
   'GTA 园艺景观,铺砖、车道、后院、Interlock,普通话服务。', '普通话',
   array['园艺','景观','铺砖','车道','后院','Interlock']),
  ('Evergreen Landscaping', 'lawn', 'Toronto / GTA', '647-871-5999',
   '多伦多及 GTA 园艺景观,车道、铺砖、Interlock、后院,提供中文专线。', '中文专线',
   array['园艺','景观','车道','铺砖','Interlock','后院']),
  ('张师傅 GTA室内装修', 'renovation', 'Toronto / GTA', '647-575-0871',
   '多伦多及 GTA 室内装修刷墙,卫生间、厨房、地下室、地板,中文服务。', '普通话＋粤语',
   array['刷墙','油漆','装修','卫生间','厨房','地下室','地板'])
) as v(name, category_id, area, phone, bio, languages, keywords)
where not exists (
  select 1 from public.directory_merchants d where d.name = v.name
);
