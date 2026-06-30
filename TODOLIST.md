# TODO List

## Supabase SQL

- [x] Run `database/users_rls_fix.sql`
- [x] Run `database/admin_backend_patch.sql`
- [x] Run `database/community_reports_and_admin_logs.sql`
- [x] Run `database/commercial_hardening_patch.sql`
- [x] Run `database/conversation_rpc.sql`
- [x] Run `database/admin_rpc.sql`
- [x] Ensure `database/inquiry_matches_rls_patch.sql` has also been applied in the target Supabase project

## Edge Functions

- [x] Deploy `supabase/functions/send-notification`
- [x] Deploy `supabase/functions/match-inquiry-providers`

## Post-Deploy Checks

- [ ] Log in with an admin account and confirm `/admin` loads normally
- [ ] Test banning a user and confirm the banned account cannot log in
- [ ] Submit a community post report and confirm it appears in admin reports
- [ ] Submit a community comment report and confirm it appears in admin reports
- [ ] Confirm the admin bell shows unread notifications after a report is submitted
- [ ] Open a notification and confirm it marks as read
- [ ] Change an inquiry status in `/admin` and confirm the DB value actually updates
- [ ] Delete a reported post/comment from `/admin` and confirm the action succeeds
- [ ] Submit an inquiry and confirm provider matching still works
- [ ] Open a provider public page and confirm it still loads after the `users` RLS changes

## Later Improvements

- [ ] Merge legacy SQL patches into a single initialization flow
- [ ] Continue moving remaining high-risk admin actions to RPC / Edge Functions
- [ ] Add a fuller notification center page instead of bell-only dropdown
- [ ] Split large frontend bundles to reduce production chunk warnings

---

## ⚠️ 复核结论 — 2026-06-20

下方 2026-04-26 的审计清单经过逐项对照当前代码,**几乎全部已在 V5.x 系列提交中实现完毕**:
ProviderProfile/ServiceDetail 已用 `Promise.all`+join；ai-chat 已加 `AbortSignal.timeout(20s)`；
坐标 0,0 占位已在 `appStore` 过滤；`useUrlFilters.ts` 已做筛选 URL 持久化；Home/Category/Search 已分页；
全局 `alert()` 已清零(改 toast);ErrorBoundary、Skeleton、各空状态、社区帖编辑、聊天重发/拉黑举报、
服务举报、全文搜索(fts migration)、报价请求追踪 等均已存在。**结论:基础体验已达 ~8.x,审计清单视为已关闭。**

邀请奖励规则「每 10 人 → 送 1 个月黄金会员」**线上已生效**(`supabase/migrations/20260531130001`,已 apply)。
本次只做清理:删除 `database/` 下两个过期冲突的 legacy 触发器文件 + 对齐 MembershipSection 文案。
注意:部署源是 `supabase/migrations/`,不是 `database/`(后者是 migration 之前的旧手动工作流)。

---

## Design & Backend Audit — 2026-04-26 (已复核关闭,见上)

### CRITICAL — Performance & Correctness

- [ ] **ProviderProfile sequential Supabase queries**: `ProviderPage` fetches provider info, services, reviews, follow status in separate `await` chains instead of `Promise.all`. On a slow connection this adds 200–600 ms of extra latency. Parallelize with `Promise.all`.
- [ ] **ServiceDetail N+1 query**: Service detail page fetches provider info separately after the service row loads. Combine into a single select with a join or fetch in parallel.
- [ ] **AI chat has no timeout**: `supabase/functions/ai-chat/index.ts` calls Groq with no `AbortSignal` / timeout. A hung Groq call will hold the edge function open until platform kills it (60 s). Add `AbortSignal.timeout(20_000)`.
- [ ] **`getRegistration` guard missing on all push paths**: Only `webPush.ts` was patched. Any other direct `serviceWorker.ready` call in future code will hang in dev mode. Audit and apply the guard consistently.
- [ ] **No coordinate validation before saving**: A service can be saved with `lat = 0, lng = 0` (null island). Add a check: if both are zero, treat as no location.

### HIGH — Missing Features

- [ ] **Community post cannot be edited after publishing**: `CommunitySection` and community post detail have no edit flow. Add an edit button (owner-only) that re-opens the compose form pre-filled.
- [ ] **No sort / filter persistence**: All filter state (category, area, price range, sort) lives in component state and resets on navigation. Sync to URL search params so back-navigation restores the previous view.
- [ ] **No "block provider" in chat**: `MessagesSection` has no way to block or report a provider. Add a report/block button in the conversation header.
- [ ] **Inquiry (获取报价) has no status shown to user**: After submitting an inquiry, the user has no UI to track responses. Add an "我的报价请求" list showing inquiry status + provider replies.
- [ ] **No pagination on service list**: The main service list fetches all matching records. Add cursor-based or page-based pagination (20 items/page) and an infinite-scroll or "Load more" trigger.
- [ ] **No "re-send message" on failure**: Chat send errors silently swallow the failure. Show an inline retry button on failed messages.
- [ ] **Referral rewards are not automated**: `count_my_referrals` RPC counts referrals but nothing grants membership upgrades or credits when a threshold is hit. Wire up a trigger or edge function.
- [ ] **No push notification preference center**: Users can subscribe/unsubscribe globally but cannot choose which event types trigger a push (new message vs. new inquiry vs. promotional).
- [ ] **Service search has no full-text search**: Filtering is category + area only. Add Postgres `tsvector` full-text search on `title + description` and expose a search input on the service list page.
- [ ] **No "report service" button on service detail page**: Users can report community posts but not services. Add a report flow on `ServiceDetail` that creates a moderation ticket.

### HIGH — UI / UX

- [ ] **Empty states are missing in several views**: `SavesSection`, `FollowsSection`, `BrowseSection`, and `MessagesSection` all show a blank white area when empty. Add illustrated empty-state components with a CTA ("还没有收藏，去看看吧").
- [ ] **WeChat copy uses `alert()`**: Copying the WeChat ID in `VerificationSection` and `ProviderProfile` falls back to `alert('微信号：...')` when clipboard API fails. Replace with an in-page toast notification.
- [ ] **No error boundaries**: The app has no React `ErrorBoundary`. Any unhandled render error in a section shows a blank white page. Add a top-level boundary that shows a friendly error card with a reload button.
- [ ] **`alert()` used for upload errors throughout**: Cover upload, avatar upload, and doc upload all call `alert(...)` on failure. Replace with inline error messages.
- [ ] **Mobile keyboard pushes map off-screen**: On mobile, opening the search bar on the home page or inquiry form causes the Google Map underneath to resize weirdly. Use `dvh` units or `visualViewport` listener to keep map height stable.
- [ ] **Tab bar on Profile overlaps content on small phones**: The sticky tab bar on `HomepageSection` uses `top-14` but on phones shorter than 667 px the content is partially hidden. Add scroll-margin-top to section anchors.
- [ ] **Cover image aspect ratio not enforced**: Cover upload accepts any image. On tall portrait images the cover area looks wrong. Crop/resize to 3:1 aspect ratio client-side before upload.
- [ ] **"查看详情" in map popup navigates via `onclick`**: The buttons in `ServiceMap`'s InfoWindow use vanilla `onclick` instead of React Router. This bypasses the SPA router, causing a full page reload on iOS. Use `navigate()` (already wired via `onInfoReady`) — confirm no full reload occurs.
- [ ] **MembershipBadge tooltip not shown on mobile**: Tapping the membership badge shows no explanation of what L1/L2/L3 means. Add a tap-to-show tooltip or link to the MembershipSection.
- [ ] **No skeleton loaders**: Most sections show nothing while loading. Add skeleton placeholder cards (matching the real card shape) to prevent layout shift.

### MEDIUM — Database & Security

- [ ] **Missing composite index on `services(category_id, is_available)`**: The main service list filters by both columns on every load. Add: `CREATE INDEX IF NOT EXISTS idx_services_cat_avail ON services(category_id, is_available);`
- [ ] **Missing index on `community_posts(created_at DESC)`**: Community feed sorts by `created_at` on every page load with no index. Add: `CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);`
- [ ] **Missing index on `messages(conversation_id, created_at)`**: Chat history query does a sequential scan per conversation. Add composite index.
- [ ] **Missing index on `push_subscriptions(user_id)`**: Web push lookup on login/logout does a full scan. Add: `CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);`
- [ ] **Self-messaging not blocked at DB level**: RLS on `messages` only checks that the sender is authenticated; nothing prevents `sender_id = recipient_id`. Add a check constraint: `CHECK (sender_id <> recipient_id)`.
- [ ] **`services.price` has no range validation**: Price can be set to negative or absurdly large values. Add: `CHECK (price IS NULL OR (price >= 0 AND price <= 100000))`.
- [ ] **`users.is_online` has no automatic reset**: If the server crashes while a user is "online", they stay flagged online forever. Add a Supabase scheduled function (pg_cron) that resets `is_online = false` for users whose `last_seen` is older than 24 hours.
- [ ] **`social_links` JSONB field is overloaded**: Cover URL, tags, and social media links all share one JSONB column with magic keys `_cover`, `_tags`. Extract to dedicated columns: `cover_url TEXT`, `tags TEXT[]`, `social_links JSONB` (for actual social links only).
- [ ] **No soft-delete on services**: Deleting a service is permanent. Old inquiry/conversation records that reference the service ID break silently. Add `deleted_at TIMESTAMP` and filter `WHERE deleted_at IS NULL`.
- [ ] **No audit log for admin actions**: `admin_logs` table exists but not all admin mutations write to it (e.g., membership grants, feature flag changes). Enforce writes via RPC.
- [ ] **`referral_code` not unique-indexed**: The column has a unique constraint but no explicit index. Verify with `\d users` and add if missing: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);`

### MEDIUM — Admin Panel

- [ ] **No search in admin user list**: Admin can only scroll/paginate through users. Add a search input that filters by name, email, or referral code.
- [ ] **No undo for ban / membership grant**: Admin actions are instant and irreversible from the UI. Add a confirmation dialog and a 5-second undo toast before the DB write commits.
- [ ] **No analytics dashboard**: Admin has no view of DAU, new sign-ups per day, services posted per week, or inquiry volume. Add a simple charts page using the existing `stats` RPC data.
- [ ] **No bulk actions**: Admin cannot ban or delete multiple users/services at once. Add checkbox selection + bulk action toolbar.
- [ ] **Reported content queue has no "resolve" state**: Admin can delete reported posts but cannot mark a report as reviewed-and-dismissed (false positive). Add a `dismissed_at` field and a dismiss button.
- [ ] **Admin cannot edit service content**: If a service has policy-violating text, admin must delete it entirely. Add an admin edit flow for service `title`, `description`, `price`.
- [ ] **No rate-limit visible in admin**: Admin cannot see which IPs or users are hitting the AI chat or push API the most. Surface top consumers in the admin dashboard.

### LOW — Copy & Content

- [ ] **Inconsistent verified badge display**: `VerifiedBadge` shows for users with any verified field, but the tooltip says "已认证商家" even for individual users who only verified their phone. Show granular badges: "手机已验证", "商户已认证".
- [ ] **Generic "未知错误" error messages**: Many catch blocks show `'未知错误'`. Replace with more actionable messages ("网络超时，请稍后重试" vs "服务器拒绝请求，请联系客服").
- [ ] **"面议" price not translated in English UI paths**: If the user's browser language is English, `面议` renders untranslated. Add English fallback: "Negotiable".
- [ ] **Category labels missing in AI chat response**: When AI recommends a service, it lists the raw `category_id` key (e.g., `cashwork`) not the display label. The label map in `ai-chat/index.ts` covers common cases but `label[cat] ?? cat` still leaks raw keys for uncovered categories. Add all categories.
- [ ] **PWA install prompt shows on every session**: `InstallPrompt` in `App.tsx` fires on every load if the `beforeinstallprompt` event fires. Suppress it if the user previously dismissed it (store a `tcs_install_dismissed` flag in localStorage).
- [ ] **"共 X 家" counter in map legend double-counts**: `mapped.length` counts all services with coordinates, not unique providers. If one provider has 3 services they count as 3. Show "共 X 项服务" or deduplicate by provider.
- [ ] **Service card "距您 X km" uses straight-line distance**: The distance shown is Haversine (bird's-eye). Label it "直线距离" or switch to Google Maps Distance Matrix API for driving distance.
- [ ] **No 404 page for `/provider/:id` when provider doesn't exist**: Visiting a dead provider link shows an infinite spinner. Add a `Not Found` state when the Supabase query returns null.

---

## 🎯 全模块 UX/UI 评审 — 2026-06-29(已复核纠偏,严格评分:8=优秀,6=能用但平庸)

平台整体 ≈ **7.2/10**(原审计给 6.5,逐项验证排除 5+ 误报后约 7.0,2026-06-29 一轮修复后约 7.2)。
唯一的 5.x 是**会员体系空权益**(需产品决策)。其余多为打磨细节。

> ⚠️ 复核教训:首版多 agent 审计的「严重 bug」类指控**误报率偏高**(未读重置、搜索防抖、已读落库、Q&A 形同虚设、Category 默认乱序、Admin 无搜索 —— 全是误报)。带行号的 bug 指控须逐个验证;可靠的是**结构性判断**(会员空洞、复用缺失)。

### 模块评分总表(分数 = 复核后)

| 区块 | 模块 | 分数 | 状态 / 一句话短板 |
|---|---|---|---|
| 发现 | 首页 Home | 7.0 | ⬆️ **首屏空状态/骨架已修**(加 servicesLoaded);技能词 `.includes()` 次要 |
| 发现 | 分类页 Category | 6.5 | ⬆️ 原 6.0;"默认按距离→乱序"是**误报**(默认 `rating`) |
| 发现 | 搜索 Search | 7.0 | ⬆️ 原 5.5;"无防抖"**误报**(gate 在提交)、技能词模糊**已修** |
| 发现 | 地图 Map/ServiceMap | 7.0 | `geoAutoRequested` 全局变量污染(内存过滤无需防抖) |
| 发现 | 推荐/Banner/微件 | 7.5 | 普遍较好;Save/Follow/ViewCount **挂载抖动已修**(淡灰就绪态/占位骨架) |
| 找服务 | 服务详情 ServiceDetail | 7.5 | 文案冗长、phone/wechat 展示不一致 |
| 找服务 | 发布服务 PostService | 6.5 | 表单 14 字段偏长、图片失败提示弱 |
| 找服务 | 服务卡 ServiceCard | 7.0 | 信任信号只显 1 个、头像 16px 太小 |
| 找服务 | 询价 InquiryModal | 7.0 | AI 解析失败无重试、流程重复填写 |
| 找服务 | 评价系统 | 7.5 | 信用分含义模糊、已评价用户入口隐蔽 |
| 找服务 | 服务商主页 ProviderProfile | 7.5 | ⬆️ **多品类 sticky tab 已加**;8 查询已并发(拆波非必要);信息过载仍可优化 |
| 找服务 | Q&A 问答(服务) | 7.0 | ⬆️ 原 4.0;**重大误报**——服务详情有成熟 `QASection`,真缺口仅「无最佳答案/投票」 |
| 垂直版块 | 二手 Secondhand | 8.0 | 全平台标杆(图片/评价/直连私信) |
| 垂直版块 | 招聘 Jobs | 7.5 | 无排序、求职模式字段不对称 |
| 垂直版块 | 活动 Events | 7.0 | 类型 8 种过多、往届不清理 |
| 垂直版块 | 租房 RealEstate | 7.0 | ⬆️ **价格筛选 UI 已加**(按租/售自适应档位);房型 7 种过细仍可精简 |
| 垂直版块 | 广场 Plaza | 6.5 | ⬆️ 原 6.0;随机洗牌**已修**;Tab 状态割裂仍在 |
| 社区沟通 | 社区 Community | 7.0 | ⬆️ 原 6.5;洗牌**已修** + "已读只存前端"是**误报**(早已落库) |
| 社区沟通 | 私信 Conversation | 7.5 | ⬆️ 原 7.0;tempId**已修** + "重置全部未读"是**误报** |
| 社区沟通 | 通知 Notifications | 6.5 | ⬆️ 管理员通知**已加「加载更多」历史**;prefs 无实时(次要)仍在 |
| 社区沟通 | AI 客服 | 6.5 | ⬆️ **超时改空闲超时**(30s 无数据才中止,长回答不再被切);localStorage 经判断非真漏洞(用户自己浏览器自己的对话,已封顶20段) |
| 账户后台 | 注册登录 Auth | 7.0 | 密码位数**已统一** |
| 账户后台 | 个人中心 Profile | 7.0 | ⬆️ **退出登录加二次确认**;模式切换 feature flag 残留(次要)仍在 |
| 账户后台 | 认证 Verification | 7.0 | ⬆️ **OTP 冷却 bug 已修**(成功后才倒计时) |
| 账户后台 | 数据面板 Stats | 6.0 | 无实时、无相对数据(需聚合 RPC,未做) |
| 账户后台 | 会员 Membership | 5.5 | DB tagline **已修**;但 L2/L3 权益空洞(战略缺口)仍压分,需产品决策 |
| 账户后台 | 邀请 Referral | 6.5 | 生成失败兜底差;文案核实后基本一致(非误报但极小) |
| 账户后台 | 我的发布 Services | 6.5 | ⬆️ 编辑图片**已加新旧标识 + 新增角标**;5 类型各写各的(大重构)仍在 |
| 账户后台 | 报价 Inquiries(双侧) | 6.5 | ⬆️ **已加评价入口**;"接单方无推送"是**误报**(notifyInquirySelected 早已发) |
| 账户后台 | 管理后台 Admin | 6.5 | ⬆️ 原 5.5;"无搜索"是**误报**(UsersTab 有搜索);批量/撤销仍缺 |

### 完善路线(可勾选)

**P0 — 已全部完成(2026-06-29,commit 5b50ef9)**
- [x] ~~Community + Plaza **随机洗牌** → `created_at` 倒序~~
- [x] ~~私信 tempId 加随机后缀防冲突~~(注:"重置全部未读"经核实是**误报**,本就 scoped 当前会话)
- [x] ~~搜索防抖~~ —— 经核实是**误报**(查询 gate 在提交、非每键;语义扩展本就有 250ms 防抖),无需改
- [x] ~~统一密码位数(改密 6→8)~~ + ~~统一举报原因常量~~(新建 `src/constants/reportReasons.ts`,6 处引用)

**P1 — 进行中**
- [x] ~~provider 技能词改**模糊匹配**~~ — RPC `search_providers_by_keyword`(unnest+ILIKE),migration `20260629120001` 已应用线上
- [x] ~~社区**已读落库**~~ — **误报**:早已由 `useReadStore`+`user_read_posts`+`useReadSync()` 实现
- [ ] 抽 `formatPrice()` + 通用 `FilterPanel` + `useImageUpload`,四个垂直版块复用(消除各造轮子)
- [ ] 关键空状态 + **骨架屏统一组件化**(消除 ViewCount/Follow/Save 挂载抖动)
- [ ] 移动端键盘遮挡修复(发帖标签选择器 / 聊天输入 / AI 输入,补 safe-area)
- [ ] `formatTime()` 相对时间统一(社区/通知/消息三处各写一份)

**P2 — 战略级,需产品决策**
- [ ] 🔴 **给 L2/L3 配真权益**(搜索靠前/曝光位/商家工具)—— 否则邀请增长引擎在空转,奖励的是没价值的徽章
- [ ] 会员 DB `membership_tiers` 的 L2/L3 tagline 过期("邀请3人送/10人送30天"),与线上真实规则(每10人→1个月)对齐
- [ ] Q&A 增强(最佳答案/投票/已解决状态)—— 已有基础问答,非重做
- [ ] 移动端详情交互四版块统一(抽屉 or 路由,二选一;现在 Jobs/二手用抽屉、租房/活动用路由)
- [ ] 后台加批量操作 / 撤销窗口;13 tab 分组(搜索已有)
- [ ] InquiryModal AI 解析失败加重试;接单方被选中加推送提醒;报价完成加评价入口

> 注:分数为 2026-06-29 复核后值;⬆️ 标记的是排除误报或已修后上修的模块。
