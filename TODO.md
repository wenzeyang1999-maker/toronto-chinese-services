# TCS Product Backlog
> 大多伦多华人服务平台 — 功能待办清单
> 按优先级排列，高优先级先做

---

## 🔴 P1 — 核心体验缺口 ✅ 全部完成

- [x] 帖子状态关闭（is_filled / is_sold）
- [x] 收藏/关注功能（SaveButton + SavesSection）
- [x] 管理后台（/admin 举报处理 + 数据概览）
- [x] 全局搜索（/search-all 5张表并行）

---

## 🟡 P2 — 提升留存 ✅ 全部完成

- [x] 个人简介 bio（AccountSection + ProviderProfile）
- [x] 分享按钮（ShareButton，Web Share API + clipboard）
- [x] Open Graph meta tags（PageMeta，分享到微信显示标题+图片）
- [x] 图片懒加载（loading="lazy"）
- [ ] 邮件通知（Supabase Edge Function，新消息触发）

---

## 🟢 P3 — 锦上添花

### 9. 评价系统增强
- [ ] 评价回复：服务提供者可回复收到的评价
- [ ] ProviderProfile 评价按星级筛选
- [ ] 评价支持上传图片（最多 3 张）

### 10. 地图集成
- [ ] 房源/服务详情页加 Google Maps 嵌入
- [ ] RealEstateList 地图视图模式

### 11. 数据分析 ✅（浏览量已完成）
- [x] 浏览量统计（ViewCount 组件 + views 表）
- [x] 我的发布页展示每个帖子的浏览次数
- [ ] 服务提供者看到各帖子浏览量趋势图

### 12. 推荐算法
- [ ] 首页「猜你喜欢」：基于浏览历史推荐
- [ ] 详情页底部「相关服务/帖子」

### 13. 多语言支持
- [ ] react-i18next 接入
- [ ] 中文（默认）/ 英文切换

---

## 🔧 技术债务

- [x] 代码分割（React.lazy + Suspense）
- [x] Error Boundary（全局错误捕获，防白屏）
- [x] useEffect 依赖数组修正（SaveButton / AdminPage / ServicesSection）
- [x] AdminPage 非空断言安全修复（review.service?.id）
- [ ] 邮件通知（Edge Function）
- [ ] Supabase RLS 审计：所有表 policy 二次核查
- [ ] 环境变量审计：确认 .env 没提交到 git

---

## ✅ 今日完成（2026-04-04）

- [x] Error Boundary — 全局白屏防护
- [x] Open Graph meta tags — 分享到微信显示标题+图片（PageMeta 组件）
- [x] 浏览量统计 — ViewCount 组件 + viewsStore + views 表
- [x] 「我的发布」每条帖子显示 👁 浏览次数
- [x] 右侧详情面板滚动 bug 修复（overflow-hidden → mb-4）
- [x] 代码审查 3 个 useEffect 依赖 bug 修复
- [x] README 全面更新（结构图 + 继承关系 + DB 表说明）

---

## ✅ 历史完成

- [x] 五大板块上线：找服务 / 招聘求职 / 二手交易 / 租房买房 / 同城活动
- [x] 公开 Profile 页（/provider/:id）
- [x] 招聘双子栏：招聘 / 求职
- [x] 「其他」分类自定义文字
- [x] 评价 👍/👎 投票 + 排序
- [x] 评价举报（送管理员审核）
- [x] 「我的发布」5类帖子统一管理
- [x] 发布房源从列表页带 listing_type 参数
- [x] 消息浮窗 + 未读角标
- [x] 图片优化工具（imgTransform.ts）

---

## ⏳ 所有 SQL 文件状态

| 文件 | 状态 |
|------|------|
| `schema.sql` | ✅ 已执行 |
| `jobs_schema.sql` | ✅ 已执行 |
| `realestate_schema.sql` | ✅ 已执行 |
| `secondhand_schema.sql` | ✅ 已执行 |
| `events_schema.sql` | ✅ 已执行 |
| `post_status_migration.sql` | ✅ 已执行 |
| `bio_migration.sql` | ✅ 已执行 |
| `review_interactions_schema.sql` | ✅ 已执行 |
| `saves_schema.sql` | ✅ 已执行 |
| `views_schema.sql` | ✅ 已执行 |

---

*最后更新：2026-04-04*
