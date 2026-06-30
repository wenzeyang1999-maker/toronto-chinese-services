# TCS Product Backlog
> 大多伦多华人服务平台 — 功能待办清单
> 最后更新：2026-04-05

---

## ✅ 全部完成的功能

### 安全加固（2026-04）
- [x] users 表 PII 泄露修复（RLS + public_profiles view）
- [x] Storage 文件枚举限制
- [x] 安全 HTTP headers（vercel.json）
- [x] 管理员高风险动作全部 RPC 化（13 个 SECURITY DEFINER 函数）
- [x] 审计日志移入 RPC，前端无法伪造
- [x] 邮件模板 HTML 注入修复
- [x] 通知接口 type 白名单防滥用
- [x] 社区举报功能上线（帖子 + 评论，DB + UI 完整）
- [x] 未读计数原子自增（RPC 替换 read-modify-write）
- [x] 评价举报/删除回复错误处理补全

### 核心板块
- [x] 找服务（5大类）
- [x] 招聘求职（招聘/求职双子栏）
- [x] 二手交易
- [x] 租房买房
- [x] 同城活动
- [x] **社区圈子**（求推荐/经验分享/问问题/随手转让，按区域筛选，图片上传）

### 用户体系
- [x] 注册/登录/忘记密码
- [x] 个人资料 + bio + 头像
- [x] 会员等级显示
- [x] 联系方式与资质验证（商户认证上传）
- [x] 公开 Provider Profile 页

### 服务商功能
- [x] 发布/管理服务
- [x] 评价系统（投票/举报/回复）
- [x] 关注服务商 + 粉丝数
- [x] 回复时间徽章（avg_reply_hours）
- [x] 认证徽章（business_verified）
- [x] 数据面板（浏览/收藏/消息/评价统计）

### 互动功能
- [x] 收藏（服务/招聘/房源等）
- [x] 消息系统（实时对话）
- [x] 帖子问答 Q&A（公开提问/服务商回答）
- [x] 评价回复（ServiceDetail + ProviderProfile 均展示）

### 发现功能
- [x] 全局搜索（5张表并行）
- [x] 猜你喜欢（相关服务）
- [x] 最近浏览类别
- [x] 浏览记录
- [x] 置顶推广（is_promoted + 管理员控制）
- [x] 星级筛选

### 通知
- [x] 邮件通知（新消息/新关注/新评价/新提问）

### 管理后台
- [x] 举报处理
- [x] 认证审核
- [x] 置顶推广管理
- [x] 社区帖子管理
- [x] 数据概览

### 技术
- [x] RLS 安全审计（修复4个漏洞）
- [x] 环境变量安全（.env 在 gitignore）
- [x] 代码分割（React.lazy）
- [x] Error Boundary
- [x] 图片压缩上传
- [x] Open Graph meta tags
- [x] AI 客服聊天组件

---

## 🟡 待做 — 中优先级

### 用户增长
- [x] ~~**分享帖子到微信/社交媒体**~~ — 帖子详情页/底部抽屉早有分享(Web Share API + 复制链接降级);2026-06-29 又给社区**列表卡片**补了分享按钮(指向该帖 URL)
- [x] ~~**关注后有新帖推送**~~ — 已实现：服务商发布新服务后,`PostService.tsx` 查 `follows` 表给所有粉丝发 `new_service_post` 邮件通知(2026-06-29 复核确认)

### 内容质量
- [x] **社区帖子举报功能**（帖子 + 评论均可举报，管理后台处理）
- [x] **搜索覆盖社区帖子**（全局搜索同时搜服务 + 社区帖子，分区块展示）

### 商业化
- [x] ~~**置顶申请入口**~~ — 已实现：「我的发布」每个服务有 ⚡「申请置顶推广」按钮 → 写入 `promo_requests` 表 → 通知管理员审核(`ServicesSection.tsx`,2026-06-29 复核确认)

---

## 🔴 待做 — 低优先级（暂缓，原因见下）

### Plan B：完整订单流 + 完工存证（正式版）
**不做原因：**
1. 对客户摩擦太大：发单→看名片→录用→等完工→确认，违背"极简"定位
2. 依赖 Plan B 抢单熔断（也还没做），需要先有 orders 表和正式录用流程
3. 现阶段用户量小，Option A（IM里上传照片）已足够建立信任
**等什么时候做：** Plan B 抢单熔断完成后、日均订单 > 50 单时
**需要的工作：** orders 表 + 状态机 + 录用UI + completion_proofs 表 + Storage bucket

### Plan B：5人抢单熔断机制
**不做原因：**
1. 需要师傅端实时抢单UI + 客户端名片墙选择页，工作量大
2. 冷启动期师傅少，Plan A 自动匹配效果相同
3. 先积累用户再加竞争机制更有意义
**设计说明：** 见 `supabase/functions/match-inquiry-providers/index.ts` 顶部注释

---

## 🟢 待做 — 低优先级 / 中期

- [x] ~~**手机号验证**~~ — 已实现：`requirePhoneVerified.ts` 接入发帖/报价/发房源等入口,需验证手机号才能发布(2026-06-29 复核确认)
- [x] ~~**服务商新帖通知**~~ — 同「关注后有新帖推送」,已实现(见上方用户增长段)
- [x] ~~**社区帖子点赞去重**~~ — 已无需做：`community_likes` 表 PK(user_id, post_id) + 触发器维护 like_count，前端走该表 insert/delete，DB 层已防重复（2026-06-20 复核）

### 代码质量（不紧急，不影响线上功能）
- [x] ~~**距离显示修复**~~ — 已确认修复：`appStore.ts:92-95` 把 `0/null` 坐标都当「无坐标」(`row.lat ? row.lat : undefined`),不再显示假的 "0 km"(2026-06-29 二次确认)
- [x] ~~**防止自问自答**~~ — migration `20260620130001_low_priority_hardening.sql` 加了 RESTRICTIVE INSERT 策略（provider 不能在自己服务下提问），已 push 生效
- [x] ~~**reviews 索引**~~ — 同上 migration 已加 `idx_reviews_reviewer_id`（idempotent），已 push 生效

---

## ⏳ SQL 文件状态

| 文件 | 状态 |
|------|------|
| `schema.sql` | ✅ |
| `jobs_schema.sql` | ✅ |
| `realestate_schema.sql` | ✅ |
| `secondhand_schema.sql` | ✅ |
| `events_schema.sql` | ✅ |
| `review_replies_schema.sql` | ✅ |
| `follows_schema.sql` | ✅ |
| `verification_migration.sql` | ✅ |
| `promoted_migration.sql` | ✅ |
| `avg_reply_hours_migration.sql` | ✅ |
| `qa_schema.sql` | ✅ |
| `rls_security_patch.sql` | ✅ |
| `community_schema.sql` | ✅ |
| `community_likes_schema.sql` | ✅ |
| `review_replies_rls_patch.sql` | ✅ |
| `saves_cleanup_triggers.sql` | ✅ |
| `users_rls_fix.sql` | ✅ |
| `admin_backend_patch.sql` | ✅ |
| `community_reports_and_admin_logs.sql` | ✅ |
| `inquiry_matches_rls_patch.sql` | ✅ |
| `admin_rpc.sql` | ✅ |
| `conversation_rpc.sql` | ✅ |
