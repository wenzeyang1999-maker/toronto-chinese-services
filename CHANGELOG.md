# Changelog

## 2026-03-29

### 新功能
- **评价系统**：服务详情页加入 Google-style 评价区，支持 1-5 星 + 文字，每人每服务一次，可编辑
- **商家主页**：`/provider/:id` 页面汇总展示商家所有评价及平均分
- **真实评分**：服务列表和详情页顶部星级来自真实 reviews 数据，无评价显示"暂无评价"
- **重置密码页**：新增 `/reset-password` 页面，支持 Supabase implicit 流和 PKCE 流
- **SPA 路由修复**：新增 `vercel.json` catch-all rewrite，直接访问深层 URL 不再 404

### 修复
- 商家主页"用户不存在"问题：拆分查询，新字段（`phone_verified`, `social_links`）单独查询，避免未迁移时整体失败
- 重置密码页逻辑：在模块级别读取 `window.location.hash`，解决 Supabase JS 在组件挂载前清除 hash 导致 `PASSWORD_RECOVERY` 事件丢失的问题
- ReviewsSection：查询报错时 loading 状态永远不清除（只判断 data 未判断 error）
- VerificationSection：手机 OTP 验证成功但 DB update 失败时仍然设置 `phone_verified: true`，导致 UI 与数据库状态不一致
- appStore：按价格排序时 `parseFloat` 返回 NaN 导致排序结果乱序

### 改进
- 商家身份块整体可点击（替代原来分散的头像/名字按钮）
- Profile 我的服务列表：编辑和删除按钮加大（`w-10 h-10`），点击卡片可跳转详情
- PostService 联系方式字段自动从 Profile 预填
- 商家主页服务列表改为 2 列网格，正方形图片比例
- ForgotPassword 显示真实 Supabase 错误信息，便于排查

### 基础设施
- 配置 Resend SMTP（端口 587）替代 Supabase 内置邮件（限制 2封/小时）
- Porkbun DNS 添加 huarenq.com 的 DKIM / SPF / MX / DMARC 记录（验证进行中）
- schema.sql 加入邮箱验证回填 SQL（安全幂等，仅更新未同步的行）

---

## 2026-03-28

### 新功能
- 商家公开主页 `/provider/:id`：头像、验证状态、联系方式、社交媒体、服务列表
- 联系方式与资质验证（Profile 菜单）：手机 OTP 验证、社交媒体链接（微信、WhatsApp、小红书、Instagram、Facebook、Line、Telegram、网站）
- 服务详情页商家卡片：显示邮箱/手机验证状态、联系方式、社交链接
- PostService 联系方式自动预填

### 修复
- 消息红点不消失：Supabase 懒执行 bug，`.update()` 未加 `.then()` 不发请求
- 消息未读数：改为 `useLocation` 监听路由变化，防 Realtime 丢包
- 邮箱未验证显示错误：回填 `is_email_verified` + 添加 `handle_email_confirmed` 触发器

### 改进
- 服务卡片去除"找"前缀（"找保洁" → "保洁"）
- 服务详情页星级放大并移至主卡片右上角
