# Toronto Chinese Services (TCS) — 大多伦多华人服务平台

多伦多华人一站式生活服务平台，涵盖本地服务、招聘求职、租房买房、二手交易和同城活动。

**线上地址：** https://toronto-chinese-services.vercel.app

---

## Tech Stack

| 层 | 技术 |
|----|------|
| 前端框架 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS + Framer Motion |
| 路由 | React Router v6 |
| 状态管理 | Zustand |
| 后端/数据库 | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| 地图 | react-leaflet v4 + OpenStreetMap |
| 邮件 | Resend API via Supabase Edge Functions |
| Meta tags | react-helmet-async |
| 部署 | Vercel (SPA 路由 via `vercel.json`) |

---

## 本地开发

```bash
npm install
npm run dev
```

在项目根目录创建 `.env`（不要提交到 Git）：

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 功能模块

| 模块 | 路由 | 说明 |
|------|------|------|
| 找服务 | `/` `/category/:id` `/service/:id` | 服务列表、分类浏览、详情 |
| 招聘求职 | `/jobs` `/jobs/:id` `/jobs/post` | 招聘/求职双子栏 |
| 租房买房 | `/realestate` `/realestate/:id` `/realestate/post` | 出租/出售/合租 |
| 二手交易 | `/secondhand` `/secondhand/:id` `/secondhand/post` | 闲置转让 |
| 同城活动 | `/events` `/events/:id` `/events/post` | 8种活动类型 |
| 社区圈子 | `/community` `/community/post` `/community/:id` | 瀑布流发帖，小红书风格 |
| 全局搜索 | `/search-all` | 5张表并行搜索 + 关键词高亮 |
| 公开主页 | `/provider/:id` | 用户资料 + 全部发布 + bio |
| 消息 | `/conversation/:id` | 买卖双方即时聊天 + 未读角标 |
| 个人中心 | `/profile` | 账号/发布/收藏/消息/浏览/AI记录 |
| 管理后台 | `/admin` | 举报处理 + 数据概览（需 role=admin） |

---

## 项目结构

```
src/
├── main.tsx                          # 入口：HelmetProvider → ErrorBoundary → App
├── App.tsx                           # 路由 (React.lazy 分包) + 消息浮窗
│
├── components/
│   ├── ErrorBoundary/                # 全局错误捕获，防白屏
│   ├── PageMeta/                     # Open Graph / Twitter Card meta tags
│   ├── SaveButton/                   # ♡ 收藏按钮（所有详情页）
│   ├── ShareButton/                  # 分享/复制链接按钮
│   ├── ViewCount/                    # 👁 浏览次数（session 去重）
│   ├── Header/                       # 顶部导航（全局搜索入口）
│   ├── SectionTabs/                  # 五大板块切换 tab
│   ├── ServiceCard/                  # 服务卡片（列表用）
│   ├── MembershipBadge/              # 会员等级徽章
│   ├── AiChatWidget/                 # AI 客服浮窗
│   ├── SearchBar/                    # 服务搜索框
│   ├── HeroCarousel/                 # 首页轮播
│   ├── ServiceMap/                   # Leaflet 地图（标记 + Popup）
│   ├── RecommendedServices/          # 猜您喜欢（基于浏览历史）
│   ├── RecentCategories/             # 最近浏览类目
│   ├── InquiryModal/                 # AI帮你找弹窗 + 自动发邮件给商家
│   └── LoadingScreen/                # 启动加载画面
│
├── store/
│   ├── authStore.ts                  # 当前登录用户
│   ├── appStore.ts                   # 服务列表 + 搜索筛选
│   ├── jobStore.ts                   # 职位列表 + 筛选
│   ├── realestateStore.ts            # 房源列表 + 筛选
│   ├── secondhandStore.ts            # 闲置列表 + 筛选
│   ├── eventsStore.ts                # 活动列表 + 筛选
│   ├── savesStore.ts                 # 收藏 Set（O(1) 查询 + 乐观更新 + 失败回滚）
│   ├── followsStore.ts               # 关注（乐观更新 + 失败回滚）
│   └── viewsStore.ts                 # 浏览量计数（session 去重）
│
├── lib/
│   ├── supabase.ts                   # Supabase 客户端
│   ├── notify.ts                     # 邮件通知封装（调用 Edge Function）
│   ├── compressImage.ts              # 图片压缩工具
│   ├── imgTransform.ts               # Supabase 图片转换 URL 工具
│   ├── toast.ts                      # 全局轻提示状态
│   └── useUrlFilters.ts              # 列表筛选与 URL query 同步
│
├── pages/
│   ├── Home/
│   ├── Category/
│   ├── Search/                       # 服务搜索
│   ├── GlobalSearch/                 # 全局搜索（5张表）
│   ├── Admin/                        # 管理后台
│   ├── ServiceDetail/
│   │   ├── ServiceDetail.tsx
│   │   └── ReviewsSection.tsx        # 评价区（👍👎 投票 + 举报）
│   ├── Jobs/
│   │   ├── types.ts
│   │   ├── JobList.tsx
│   │   ├── JobDetail.tsx
│   │   └── PostJob.tsx
│   ├── RealEstate/
│   │   ├── types.ts
│   │   ├── RealEstateList.tsx
│   │   ├── RealEstateDetail.tsx
│   │   └── PostProperty.tsx
│   ├── Secondhand/
│   │   ├── types.ts
│   │   ├── SecondhandList.tsx
│   │   ├── SecondhandDetail.tsx
│   │   └── PostListing.tsx
│   ├── Events/
│   │   ├── types.ts
│   │   ├── EventList.tsx
│   │   ├── EventDetail.tsx
│   │   └── PostEvent.tsx
│   ├── Profile/
│   │   ├── Profile.tsx
│   │   ├── types.ts
│   │   └── sections/
│   │       ├── AccountSection.tsx    # 账号设置 + bio 编辑
│   │       ├── ServicesSection.tsx   # 我的发布（5类）+ 浏览量
│   │       ├── SavesSection.tsx      # 我的收藏（分类 tab）
│   │       ├── MessagesSection.tsx
│   │       ├── BrowseSection.tsx
│   │       ├── ChatSection.tsx
│   │       ├── VerificationSection.tsx
│   │       └── MembershipSection.tsx
│   ├── Community/
│   │   ├── CommunityPage.tsx         # 瀑布流列表（CSS columns masonry）
│   │   ├── PostCommunity.tsx         # 发帖（小红书风格，图片优先）
│   │   └── CommunityDetail.tsx       # 帖子详情 + 评论
│   ├── ProviderProfile/
│   │   └── ProviderProfile.tsx       # 公开主页（bio + 全部发布）
│   ├── Conversation/
│   │   └── ConversationPage.tsx
│   └── Auth/
│       ├── Login.tsx
│       ├── Register.tsx
│       ├── ForgotPassword.tsx
│       └── ResetPassword.tsx
│
└── data/
    └── categories.ts
```

---

## 继承关系（单箭头）

```
main.tsx
  → HelmetProvider       (react-helmet-async，提供 OG meta 上下文)
    → ErrorBoundary      (全局错误捕获，防白屏)
      → BrowserRouter
        → App            (路由 + 消息浮窗)
          → 各页面       (React.lazy 按需加载)
            → PageMeta        → <head> OG tags
            → SaveButton      → savesStore → supabase.saves
            → ShareButton     → Web Share API / clipboard
            → ViewCount       → viewsStore → supabase.views
            → ReviewsSection  → supabase.reviews / review_votes / review_reports
```

---

## 数据库表（全部启用 RLS）

| 表 | 说明 |
|----|------|
| `users` | 用户（bio, membership_level, social_links, role） |
| `services` | 服务发布 |
| `jobs` | 招聘/求职（is_filled） |
| `properties` | 房源（is_filled） |
| `secondhand` | 闲置（is_sold） |
| `events` | 活动 |
| `reviews` | 评价（helpful_count / unhelpful_count） |
| `review_votes` | 评价👍👎（每人每条唯一） |
| `review_reports` | 举报（pending/dismissed/removed） |
| `saves` | 收藏（多态：target_type + target_id） |
| `views` | 浏览量（多态，支持匿名） |
| `conversations` | 聊天会话 |
| `messages` | 聊天消息 |
| `community_posts` | 社区帖子 |
| `community_comments` | 帖子评论 |
| `community_likes` | 帖子点赞（去重，防重复） |
| `inquiries` | AI帮你找 询价记录 |

---

## 邮件通知体系

所有邮件通过 Resend API 发送，Edge Function `send-notification` 统一处理。

| 触发事件 | 收件人 | 模板类型 |
|----------|--------|----------|
| AI 帮你找 提交 | 匹配商家（评分最高最多5家） | `provider_inquiry` |
| 新消息 | 商家/客户 | `new_message` |
| 新关注 | 被关注者 | `new_follower` |
| 新评价 | 商家 | `new_review` |
| 服务被提问 | 商家 | `new_question` |
| 注册成功 | 新用户 | `welcome` |

匹配逻辑见 `supabase/functions/match-inquiry-providers/index.ts`：按类别筛选 available 服务 → 按商家去重 → 按 rating 降序 → 取前5。

---

## 设置管理员

在 Supabase SQL Editor 执行：

```sql
UPDATE public.users SET role = 'admin' WHERE email = '你的邮箱';
```

访问 `/admin` 进入管理后台。

---

---

## Changelog

### 2026-04-06
- **AI 帮你找 邮件通知**：询价提交后自动匹配商家并发邮件（`supabase/functions/match-inquiry-providers/index.ts`）
  - 按类别筛选、按 rating 排序、去重，≥5家取前5，全部 fire-and-forget
  - `notify.ts` 新增 `notifyProviderInquiry()` 类型化封装
  - Edge Function 新增 `provider_inquiry` 邮件模板
- **搜索页**新增 AI 帮你找入口按钮（`Search.tsx`）
- **FAB 发帖按钮**：招聘、二手、租房、活动四个板块统一改为左下角磨砂玻璃蓝悬浮圆形按钮，移除 header 内嵌发布按钮
- **Bug fix**：`EventList` 详情面板切换活动时图片索引未重置（补 `useEffect`）
- **安全**：社区发帖图片路径改为 `timestamp.ext`，移除原始文件名防路径注入

### 2026-04-05
- **ServiceCard 重设计**：大图卡片改为横向紧凑行（72px 缩略图 + 文字主导）；地区显示截断为第一个防移动端溢出
- **社区圈子**：新增 Header + SectionTabs，宽度与全站统一；改为纯 CSS `columns` 瀑布流；每次刷新随机排序；发帖改为 FAB
- **PostCommunity**：重设计为小红书风格——图片优先，类型/地区改为底部 bottom bar 可选 Tag
- **SectionTabs**：挂载时自动 `scrollIntoView` 至当前 Tab 防止重置（`data-active` 属性定位）
- **首页找服务 Tab**：点击后平滑滚动至搜索栏（修复偏移量 -110 + `searchParams` useEffect 依赖 + setTimeout 50ms）
- **Category 页**：新增地图/列表切换 + AI 帮你找按钮；缩小 banner；宽度与全站对齐
- **首页**新增「猜您喜欢」推荐模块（`RecommendedServices`，基于浏览历史类目，降级为高评分服务）

### 早期
- `savesStore` / `followsStore`：乐观更新失败时自动回滚，避免 UI 与 DB 不同步
- `PostService`：修复 `service_types` upsert 用 `ignoreDuplicates: false` 导致 `usage_count` 被重置为 1 的 bug
- `Profile`：两次 DB 查询合并为一次；`VALID_SECTIONS` 从 `MENU` 派生，消除硬编码不同步隐患
- `react-leaflet` 从 v5 降至 v4，修复 Vercel 构建失败（v5 要求 React 19，项目用 React 18）
- `Register.tsx`：修复 `useEffect` 缺少 `searchParams` 依赖导致参数读取不稳定

*最后更新：2026-04-06*
