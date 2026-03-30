# Toronto Chinese Services (TCS)

多伦多华人一站式服务平台 — 用户可以搜索、比较、找到所需的华人服务商。

**线上地址：** https://toronto-chinese-services.vercel.app

---

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + Framer Motion
- React Router v6
- Zustand（状态管理）
- Supabase（PostgreSQL + Auth + Storage + Realtime）
- Resend SMTP（邮件服务，域名 huarenq.com）
- Vercel（部署，SPA 路由 via `vercel.json`）

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

## 项目结构

```
src/
├── App.tsx                        # 路由 + 全局浮动按钮（消息、AI客服）
├── store/
│   ├── appStore.ts                # 服务列表、搜索筛选、地理位置、评分
│   └── authStore.ts               # 当前登录用户
├── lib/
│   ├── supabase.ts                # Supabase 客户端
│   └── compressImage.ts           # 图片压缩工具
├── data/categories.ts             # 服务分类定义
├── pages/
│   ├── Home/                      # 首页
│   ├── Category/                  # 分类列表
│   ├── Search/                    # 搜索 + 筛选
│   ├── ServiceDetail/
│   │   ├── ServiceDetail.tsx      # 服务详情
│   │   └── ReviewsSection.tsx     # 评价区（查看 + 提交 + 编辑）
│   ├── ProviderProfile/
│   │   └── ProviderProfile.tsx    # 商家主页（资料 + 服务列表 + 全部评价）
│   ├── PostService/               # 发布服务
│   ├── Profile/
│   │   ├── Profile.tsx
│   │   ├── types.ts
│   │   └── sections/
│   │       ├── AccountSection.tsx
│   │       ├── ServicesSection.tsx
│   │       ├── MessagesSection.tsx
│   │       ├── BrowseSection.tsx
│   │       └── VerificationSection.tsx  # 联系方式 + 手机验证 + 社交媒体
│   ├── Conversation/              # 聊天对话页
│   ├── Auth/
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── ForgotPassword.tsx
│   │   └── ResetPassword.tsx      # 邮件链接重置密码
│   └── AiChatWidget/              # AI 客服浮窗
└── types.ts                       # 全局类型（Service, Provider 等）
```

---

## 路由

| 路径 | 页面 |
|------|------|
| `/` | 首页 |
| `/category/:id` | 分类服务列表 |
| `/search` | 搜索结果 |
| `/service/:id` | 服务详情 |
| `/provider/:id` | 商家主页 |
| `/post` | 发布服务 |
| `/profile` | 个人中心 |
| `/conversation/:id` | 消息对话 |
| `/login` | 登录 |
| `/register` | 注册 |
| `/forgot-password` | 忘记密码 |
| `/reset-password` | 重置密码（邮件链接跳转） |

---

## 功能模块

### 服务浏览
- 首页展示最新服务卡片，支持分类筛选和搜索
- 服务详情页：图片轮播（移动端）/ 动态图片宫格（桌面端）
- 真实评分（来自 reviews 表），无评价时显示"暂无评价"

### 发布服务
- 6 大分类 + 关键词搜索（~80 个内置服务类型 + 数据库众包扩展）
- 最多上传 3 张图片（压缩 + Storage 上传）
- 联系方式自动从 Profile 预填

### 即时通讯
- 发消息：客户在服务详情页点击「发消息」自动创建/复用对话
- 乐观更新 + 实时消息推送（Supabase Realtime）
- 全局消息红点（路由切换时刷新，防 Realtime 丢包）

### 评价系统
- Google-style 星级评价（1-5 星 + 文字）
- 每用户每服务只能评价一次，可编辑自己的评价
- 商家主页汇总展示所有评价及平均分

### 用户 & 商家
- 注册 / 登录 / 忘记密码 / 重置密码
- 个人中心：账号、我的服务（可编辑/上下架/删除）、消息、浏览记录
- 联系方式与资质验证：手机 OTP、社交媒体链接（微信、WhatsApp、小红书等）
- 商家公开主页（`/provider/:id`）：资料 + 服务列表 + 全部评价

### AI 助手
- 全局悬浮 AI 对话窗口（右下角），支持中文服务咨询

---

## 数据库

Schema 在 `database/schema.sql`，可安全重复运行（所有语句带 `IF NOT EXISTS`）。

**数据表清单：**

| 表名 | 用途 |
|------|------|
| `users` | 用户资料（姓名、电话、微信、头像、社交媒体、验证状态） |
| `categories` | 服务分类 |
| `services` | 服务帖子 |
| `service_types` | 众包服务名称库 |
| `conversations` | 对话（含未读计数） |
| `messages` | 聊天消息 |
| `reviews` | 服务评价（星级 + 文字） |

**首次部署需额外运行的迁移 SQL：**

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';

UPDATE public.users u
SET is_email_verified = true
FROM auth.users a
WHERE u.id = a.id
  AND a.email_confirmed_at IS NOT NULL
  AND u.is_email_verified = false;
```

**关键设计决策：**
- Supabase JS 懒执行：所有查询必须 `.then()` 或 `await` 才会发出请求
- 新字段单独查询，避免未迁移时整体失败（split-fetch 模式）
- 密码重置在模块级别读取 `window.location.hash`（Supabase JS 在组件挂载前清除 hash）
- 消息未读数用 `useLocation` 监听路由变化，而非完全依赖 Realtime

---

## 部署（Vercel）

```bash
git add .
git commit -m "描述改了什么"
git push
```

推送后 Vercel 自动部署，约 20-60 秒上线。`vercel.json` 已配置 SPA catch-all rewrite。

---

## 邮件服务（Resend）

- SMTP Host: `smtp.resend.com:587`
- 发件域名: `huarenq.com`（已在 Porkbun 配置 DNS）
- Sender: `noreply@huarenq.com`
- DNS 记录: DKIM (TXT) + SPF (TXT) + MX + DMARC
