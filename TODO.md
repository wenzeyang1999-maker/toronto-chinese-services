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

## 🟡 P2 — 提升留存（1项待做）

- [x] 个人简介 bio
- [x] 分享按钮（Web Share API）
- [x] Open Graph meta tags（微信分享）
- [x] 图片懒加载
- [ ] **邮件通知**（Supabase Edge Function，新消息触发）

---

## 🔴 P1+ — 信任与变现（竞品分析新增，优先级最高）

### A. 服务商认证完善 ⭐⭐⭐⭐⭐
**问题：** 用户不敢联系陌生服务商，缺乏信任机制是平台最大瓶颈。VerificationSection 框架已有，需完善。
- [ ] 身份证/护照上传验证 → 「实名认证」徽章
- [ ] 营业执照上传 → 「商户认证」徽章
- [ ] 高危类目（保姆/装修/搬家）标注「需背景调查」提示
- [ ] ProviderProfile 展示认证徽章组合
- [ ] 管理后台加认证审核队列

### B. 评价回复 ⭐⭐⭐⭐⭐
**问题：** 大众点评/Yelp 标配功能，服务商无法回复评价 = 无法维护口碑 = 服务商留存差。
- [ ] `review_replies` 表（reply_id, review_id, replier_id, content, created_at）
- [ ] 服务详情页评价下方加「回复」入口（仅服务商可见）
- [ ] 回复显示在评价下方，带「服务商回复」标签
- [ ] ProviderProfile 评价也展示回复

### C. 关注服务商 ⭐⭐⭐⭐
**问题：** 没有粉丝机制，服务商发新内容没人知道，用户找不回之前看过的好服务商。
- [ ] `follows` 表（follower_id, provider_id, created_at，UNIQUE）
- [ ] ProviderProfile 加「关注」按钮 + 粉丝数显示
- [ ] Profile → 新增「我的关注」section（已关注的服务商列表）
- [ ] 关注后有新帖子时推送通知（依赖邮件通知）

### D. 置顶推广帖子（变现入口）⭐⭐⭐⭐
**问题：** 平台目前无变现，长期靠流量无法持续。置顶是最简单的变现切入点。
- [ ] `services/jobs/properties` 表加 `is_promoted BOOLEAN DEFAULT false`
- [ ] 搜索/列表结果中推广帖子排在前面，加「推广」角标
- [ ] 「我的发布」加「申请推广」入口（暂时人工处理）
- [ ] 管理后台可手动开启/关闭推广状态

---

## 🟡 P2+ — 活跃度提升（竞品分析新增）

### E. 服务商快速回复率 ⭐⭐⭐
**问题：** Yelp 数据：显示回复时间的服务商转化率高 30%。
- [ ] `users` 表加 `avg_reply_hours FLOAT`（定期计算）
- [ ] ProviderProfile 显示「通常在 X 小时内回复」
- [ ] 每次消息回复时更新平均值

### F. 「猜你喜欢」推荐 ⭐⭐⭐
**问题：** 用户浏览历史已有（tcs_browse_history），利用起来提升二次访问。
- [ ] 服务详情页底部「相关服务」（同 category_id，限 4 条）
- [ ] 首页「最近浏览过的类别」快捷入口
- [ ] 不需要 AI，纯 SQL 按分类查询

### G. 帖子问答 Q&A ⭐⭐⭐
**问题：** 大众点评核心功能，用户有问题现在只能发消息，效率低且不公开。
- [ ] `questions` 表（service_id, asker_id, content, created_at）
- [ ] `answers` 表（question_id, answerer_id, content, created_at）
- [ ] 服务详情页加「问答」区块
- [ ] 服务商和其他用户均可回答

---

## 🟢 P3 — 差异化竞争（中期）

### H. 邻里社区圈子 ⭐⭐⭐
Nextdoor 核心差异化：超本地社区感，这是对抗 Yelp 的最大护城河。
- [ ] 新板块「社区」：按区域分组（North York / Markham / Mississauga…）
- [ ] 帖子类型：求推荐 / 分享经验 / 问个问题 / 二手转让
- [ ] 需要新 schema：`community_posts` 表

### I. 服务商数据面板 ⭐⭐
美团商家后台思路，提升服务商活跃度。
- [ ] 服务商专属页：本周浏览 / 收藏 / 消息数统计
- [ ] 基于现有 views / saves 表聚合即可
- [ ] 「本周有 X 人看了你的服务」推送提醒

### J. 评价按星级筛选 ⭐⭐
- [ ] ProviderProfile 评价区加星级 tab（全部/5星/4星/…）
- [ ] 纯前端过滤，无需 DB 改动

---

## 🔧 技术债务

- [x] 代码分割（React.lazy + Suspense）
- [x] Error Boundary（全局错误捕获，防白屏）
- [x] useEffect 依赖数组修正
- [x] AdminPage 非空断言安全修复
- [ ] 邮件通知（Supabase Edge Function）
- [ ] Supabase RLS 全表审计
- [ ] 环境变量审计（.env 未提交确认）

---

## ✅ 今日完成（2026-04-04）

- [x] Error Boundary — 全局白屏防护
- [x] Open Graph meta tags — 分享微信显示标题+图片
- [x] 浏览量统计 — ViewCount + viewsStore + views 表
- [x] 「我的发布」每条帖子显示 👁 浏览次数
- [x] 右侧详情面板滚动 bug 修复
- [x] 3 个 useEffect 依赖 bug 修复
- [x] README 全面更新

---

## ✅ 历史完成

- [x] 五大板块上线：找服务 / 招聘求职 / 二手交易 / 租房买房 / 同城活动
- [x] 公开 Profile 页（/provider/:id）+ bio
- [x] 招聘双子栏：招聘 / 求职
- [x] 评价 👍/👎 投票 + 排序 + 举报
- [x] 「我的发布」5类帖子统一管理 + 标记完成
- [x] 消息浮窗 + 未读角标
- [x] 收藏/关注功能
- [x] 分享按钮
- [x] 管理后台 /admin
- [x] 全局搜索 /search-all
- [x] 代码分割 + Error Boundary

---

## ⏳ SQL 文件状态（全部已执行）

| 文件 | 状态 |
|------|------|
| `schema.sql` | ✅ |
| `jobs_schema.sql` | ✅ |
| `realestate_schema.sql` | ✅ |
| `secondhand_schema.sql` | ✅ |
| `events_schema.sql` | ✅ |
| `post_status_migration.sql` | ✅ |
| `bio_migration.sql` | ✅ |
| `review_interactions_schema.sql` | ✅ |
| `saves_schema.sql` | ✅ |
| `views_schema.sql` | ✅ |

---

*最后更新：2026-04-04*
