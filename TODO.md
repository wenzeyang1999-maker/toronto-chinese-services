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
- [ ] **分享帖子到微信/社交媒体**（社区帖子目前没有分享按钮）
- [ ] **关注后有新帖推送**（用户关注服务商后，服务商发新内容发邮件通知）

### 内容质量
- [x] **社区帖子举报功能**（帖子 + 评论均可举报，管理后台处理）
- [x] **搜索覆盖社区帖子**（全局搜索同时搜服务 + 社区帖子，分区块展示）

### 商业化
- [ ] **置顶申请入口**（「我的发布」加「申请置顶」按钮，目前只有管理员能手动开启）

---

## 🟢 待做 — 低优先级 / 中期

- [ ] **手机号验证**（Supabase Phone Auth 或第三方短信）
- [ ] **服务商新帖通知**（关注了的用户收到邮件）
- [ ] **社区帖子点赞去重**（目前 like_count 没有防重复点赞机制）

### 代码质量（不紧急，不影响线上功能）
- [ ] **距离显示修复**：`src/store/appStore.ts` — 服务无坐标时用多伦多中心坐标填充，导致显示"0 km"；应改为不显示距离
- [ ] **防止自问自答**：`database/qa_schema.sql` — 用户可在自己的服务上提问并回答刷 Q&A；RLS INSERT 策略加 `asker_id ≠ service.provider_id` 检查
- [ ] **reviews 索引**：`database/schema.sql` — `reviews` 表缺 `reviewer_id` 索引，查询某用户所有评价时全表扫描；加 `CREATE INDEX idx_reviews_reviewer_id ON reviews (reviewer_id)`

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
