# Toronto Chinese Services (TCS)

多伦多华人一站式服务平台 — 用户可以搜索、比较、找到所需的华人服务商。

**线上地址：** https://toronto-chinese-services.vercel.app

---

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- React Router v6
- Zustand
- Supabase (PostgreSQL + Auth + Storage + Realtime)

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

在项目根目录创建 `.env` 文件（不要提交到 Git）：

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 功能模块

### 服务浏览
- 首页展示最新服务卡片，支持分类筛选和搜索
- 服务详情页：图片轮播（移动端）/ 动态图片宫格（桌面端）、联系方式、发消息入口

### 发布服务
- 6 大分类快捷选择 + 关键词搜索（~80 个内置服务类型 + 数据库众包扩展）
- 最多上传 3 张图片（压缩 + Storage 上传）
- 多选服务地区（热门城市 + 搜索 + 自定义）
- 用户输入的新服务类型自动保存到 `service_types` 表，供他人搜索复用

### 即时通讯
- 发消息：客户在服务详情页点击「发消息」自动创建/复用对话
- 聊天页面：乐观更新（发送即显示）+ 实时消息推送 + 防重复去重
- 消息中心：对话列表、未读角标、实时刷新
- 全局消息按钮：右下角悬浮，有未读消息时显示红点

### 用户系统
- 注册 / 登录 / 找回密码
- 个人中心：账号信息、我的服务、消息、浏览记录、AI 对话历史
- 头像上传（Supabase Storage）

### AI 助手
- 全局悬浮 AI 对话窗口（右下角），支持中文服务咨询

---

## 数据库

数据库 Schema 在 `database/schema.sql`，可安全重复运行（所有语句带 `IF NOT EXISTS` 保护）。

在 Supabase SQL Editor 中运行一次即可建立所有表、索引、RLS 策略和触发器。

**数据表清单：**

| 表名 | 用途 |
|------|------|
| `users` | 用户资料（姓名、电话、微信、头像） |
| `categories` | 服务分类（搬家、保洁、接送等） |
| `services` | 服务帖子（标题、描述、价格、图片、地区） |
| `service_types` | 众包服务名称库，搜索时自动补全 |
| `conversations` | 用户对话（含未读计数） |
| `messages` | 聊天消息 |
| `reviews` | 服务评价（预留） |

**Auth 流程：**
1. 前端调用 `supabase.auth.signUp()` 创建 Auth 用户
2. 数据库触发器 `on_auth_user_created` 自动写入 `public.users` 表
3. 触发器使用 `SECURITY DEFINER` 绕过 RLS，无需手动 insert

**Storage Buckets：**
- `service-images` — 服务图片（authenticated 用户可上传，公开可读）
- `avatars` — 用户头像（同上）

---

## 部署流程（Vercel）

### 第一次部署

**1. 初始化 Git 并推到 GitHub**

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/你的用户名/toronto-chinese-services.git
git branch -M main
git push -u origin main
```

> GitHub push 需要 Personal Access Token（不支持密码）：
> 头像 → Settings → Developer settings → Personal access tokens → Tokens (classic)
> 生成时勾选 `repo` → Contents: Read and write

**2. 在 Vercel 部署**

1. 登录 [vercel.com](https://vercel.com)（用 GitHub 账号）
2. Add New Project → 选择 `toronto-chinese-services`
3. Framework 自动识别为 **Vite**
4. 展开 **Environment Variables**，添加：
   - `VITE_SUPABASE_URL` = 你的 Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = 你的 Supabase anon key
5. 点击 **Deploy**

### 后续更新

每次修改代码后：

```bash
git add .
git commit -m "描述改了什么"
git push
```

推送后 Vercel 自动重新部署，约 20 秒上线。

### 注意事项

- `.env` 已加入 `.gitignore`，不会上传到 GitHub
- Vercel 服务器需要在控制台单独配置 Environment Variables
- Vercel Hobby 计划免费，没有访问时不消耗资源，无需手动开关
