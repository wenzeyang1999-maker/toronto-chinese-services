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
│   ├── InquiryModal/                 # 咨询弹窗
│   └── LoadingScreen/                # 启动加载画面
│
├── store/
│   ├── authStore.ts                  # 当前登录用户
│   ├── appStore.ts                   # 服务列表 + 搜索筛选
│   ├── jobStore.ts                   # 职位列表 + 筛选
│   ├── realestateStore.ts            # 房源列表 + 筛选
│   ├── secondhandStore.ts            # 闲置列表 + 筛选
│   ├── eventsStore.ts                # 活动列表 + 筛选
│   ├── savesStore.ts                 # 收藏 Set（O(1) 查询 + 乐观更新）
│   └── viewsStore.ts                 # 浏览量计数（session 去重）
│
├── lib/
│   ├── supabase.ts                   # Supabase 客户端
│   ├── compressImage.ts              # 图片压缩工具
│   └── imgTransform.ts              # Supabase 图片转换 URL 工具
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

---

## 设置管理员

在 Supabase SQL Editor 执行：

```sql
UPDATE public.users SET role = 'admin' WHERE email = '你的邮箱';
```

访问 `/admin` 进入管理后台。

---

*最后更新：2026-04-04*
