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
- Supabase (PostgreSQL + Auth)

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

## 数据库

数据库 Schema 在 `database/schema.sql`，可安全重复运行（所有语句带 `IF NOT EXISTS` 保护）。

在 Supabase SQL Editor 中运行一次即可建立所有表、索引、RLS 策略和触发器。

**Auth 流程：**
1. 前端调用 `supabase.auth.signUp()` 创建 Auth 用户
2. 数据库触发器 `on_auth_user_created` 自动写入 `public.users` 表
3. 触发器使用 `SECURITY DEFINER` 绕过 RLS，无需手动 insert

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
