# 华邻 (TCS) 安全修复记录

> 一轮系统性安全整改的归档。原则:**每改一处 RLS/权限,就用 `pg_policies` / 影响测试核一次**,不盲扫。
> 最后更新:2026-07(以 git 历史与迁移文件为准)。

---

## 1. 数据库 / RLS(migrations 20260706120001–120007)

| 编号 | 问题 | 修复 | 迁移 |
|---|---|---|---|
| C1 | `accept_inquiry` IDOR:入参 `p_provider_id` 可冒充他人接单 | 改用 `auth.uid()`,忽略入参;校验调用者确有该品类在架服务 | `...120001_fix_accept_inquiry_idor` |
| C2 | 信用扣分 RPC 无授权:任意人可扣他人分 | 加 `is_admin()` 门控 + `REVOKE ... FROM PUBLIC`,仅 authenticated 可执行 | `...120002_fix_credit_penalty_auth` |
| C3 | 证件/敏感列匿名可枚举 | `REVOKE SELECT (qualification_images, referred_by) ... FROM anon` | `...120004_revoke_anon_sensitive_cols` |
| C4 | 上线时写入**原始 GPS 坐标** | 存库前 `offsetLocation()`(300–900m 随机偏移 + 3 位小数)| 前端 `HomepageSection` |
| H1 | 白嫖置顶:poster 可直接 UPDATE `is_promoted` 自我置顶(5 张表都有此列) | 用 SECURITY DEFINER `row_is_promoted()` 读已提交值,重锁 jobs/events/properties 的 UPDATE 策略(services/secondhand 此前已锁) | `...120007_lock_is_promoted_all` |
| L1 | 触发器函数缺 `search_path` | `sync_close_*` 重建加 `SET search_path = public` | `...120003_sync_close_search_path` |

**踩坑教训**:早期一个正则盲扫迁移(`sweep_policy_fixes`)误删了 users 防提权守卫 + 三张表的 is_promoted 守卫,连坏两次。此后改为**逐条改、逐条用 `pg_policies` 核**。

---

## 2. PII 收口(phone / wechat / email)

**问题**:`users` 表列级 SELECT 对 authenticated 全开 → 任意登录用户可 `select phone/wechat/email from users` 批量抓取(含**客户**)。商家联系方式是有意公开的,但客户的不是,而它们同列 —— Postgres 无法按行遮列。

**方案**:把联系方式读取移到 SECURITY DEFINER RPC,再 REVOKE 列。

| 项 | 修复 | 迁移 |
|---|---|---|
| H2 phone/wechat | `get_my_contact()`(本人预填)、`get_contact(target)`(本人/admin/商家/会话对方才返回);REVOKE phone,wechat | `...120005_contact_rpcs`, `...120006_revoke_users_contact_from_clients` |
| email(2 步) | `get_contact` 增返 email;`admin_get_user_emails(ids[])`(is_admin 门控,给后台);`public_profiles` 视图重建去 email;`REVOKE SELECT(email)` from public/anon/authenticated | `...120009_email_lockdown_rpcs`, `...120010_email_lockdown_revoke` |
| 后台按邮箱搜人 | 收口后客户端不能再按 email 过滤 → `admin_search_user_ids(kw)`(is_admin 门控,服务端按 名字/邮箱/邀请码 匹配返回 id) | `...120011_admin_search_user_ids` |

**验证**(非 admin 视角,impersonation 测试):`select email from users` → `42501 permission denied`;`admin_get_user_emails(...)` → 0 行;`public_profiles` 列中无 email。**通过**。

**前端迁移**:ServiceDetail / ProviderProfile 的商家 email 改从 `get_contact` 取;5 个后台 tab(用户/会员/认证/日志/服务)去掉 select/join 里的 email,加载后经 `admin_get_user_emails` 按 id 合并(见 `src/pages/Admin/adminEmails.ts`)。

---

## 3. 存储(Storage)

| 问题 | 修复 | 迁移 |
|---|---|---|
| 路径劫持:`service-images` 上传策略只校验桶、不校验路径 owner → 可上传到 `qualifications/{他人id}/…` 冒充/覆盖 | 删除松策略,建 `own folder upload`(要求 `auth.uid()` 是 object 路径某段)。所有真实上传路径都含 uid,合法上传不受影响 | `...120008_storage_own_folder_upload` |

证件私有桶:**判为非必须**(证件多为普通资质)。缓解措施 = 资质上传区加**隐私提示**(勿传身份证件/建议打码,`VerificationSection` + `HomepageSection`)+ C3 已堵匿名枚举。

---

## 4. 边缘函数(Edge Functions)

| 函数 | 问题 | 修复 |
|---|---|---|
| **send-otp** | 限流按 user_id 数 `phone_otps`,但每次发送前 delete 该用户历史 → 窗口永远数不到,限流**实际失效**;且无按目标号码限流(单账号可轰炸任意号码) | 新增只追加流水表 `otp_send_log`(与 verify 会删改的 phone_otps 解耦),按 **user_id 和 phone 双维度**限流(各 3 条/10 分钟),仅成功发送计入 |
| **ai-chat / extract-inquiry** | 匿名可调 + 无输入上限 → 匿名刷 Groq 烧钱 | 按 **IP 限流**(`ai_call_log`:ai-chat 40 / extract 15,每 10 分钟)+ 输入截断(ai-chat 保留最近 12 条、每条≤2000 字;extract≤2000 字) |
| **moderate-content / ai-service-tools** | 已登录 + 已截断,但仍调 Groq,可被脚本循环 | 加按 **user_id 限流**(60 / 40 每 10 分钟,阈值宽,真实用户无感) |
| **H3 send-web-push** | follower 模式可向任意人推送任意标题/链接(推送钓鱼) | follower 模式校验"对方确实关注调用者",否则 403 |
| **H4 match-inquiry-providers** | 可为任意询价触发派单/劫持 | 校验调用者已登录且 `inquiry.user_id === caller`,否则 403;HTML 转义;`race_status='filled'` 去重 |

**新增限流表**:`otp_send_log` / `ai_call_log` 均 RLS 开、无策略(仅 service_role 可访问),过期行顺手清。共享助手 `supabase/functions/_shared/aiRateLimit.ts`。

**send-notification**:admin 广播已收窄到只能给 admin 发举报/申请,低危,未改。

---

## 4b. 第二轮加固(migration 20260707120001)

| 问题 | 修复 |
|---|---|
| `use_free_promotion(p_days)` 无上限 → 传 `p_days=100000` 把置顶钉几百年,架空付费延长 | 夹到 **1–7 天**(`least(greatest(coalesce(p_days,3),1),7)`) |
| `service_types` INSERT `WITH CHECK(true)` + UPDATE `USING(true)` → 任意登录用户可改全站共享分类 / 刷 `usage_count` 顶置 | INSERT 约束(`usage_count=1` + category 非空 + name 限长);UPDATE **改 admin 专属**(app 只 INSERT 不 UPDATE) |
| 存储 owner 校验偏弱:`uid = ANY(foldername)`,uid 是路径任意段即过 → `{victim}/{attacker}/file` 可在受害者前缀下投放 | 收紧为 **uid 必须是第 1 段,或(第 1 段是已知前缀 且 第 2 段是 uid)**。前缀白名单:realestate/qualifications/events/chat-photos/community/secondhand |
| `row_is_promoted(p_table)` 无表白名单(低危,`%I` 已防注入,仅可探测表存在性) | 加白名单:仅 services/jobs/events/properties/secondhand |

## 4c. 低危列守卫(migration 20260707120002)

| 问题 | 修复 |
|---|---|
| `inquiries` owner-UPDATE 无列守卫:owner 可把任意 uid 塞进 `accepted_provider_ids`(SELECT 策略据此授权读取)或改 `race_status` → 把带自己联系方式的假 lead 注入任意商家队列 | 用 SECURITY DEFINER 助手锁 `accepted_provider_ids` + `race_status` 两列(owner 只能改 status/assigned_provider_id,即前端实际写的字段);派单/抢单走 service_role / DEFINER RPC 不受影响 |
| `community_posts.like_count` 作者可直接改;且维护触发器**非** DEFINER → 非作者点赞被 RLS 挡,计数不加(潜在功能 bug) | 触发器改 SECURITY DEFINER(修 bug + 成为唯一写者)+ 作者 UPDATE 策略锁 `like_count` 列 |
| `views` INSERT `WITH CHECK(true)` | 加约束 `viewer_id IS NULL OR = auth.uid()`(禁止冒充他人 viewer);**计数灌水为花瓶指标(前端 localStorage 去重),记为已知接受** |

## 4d. 事后修复:contact RPC 类型 bug(migration 20260711120001)

**症状**:email 收口后,服务详情/商家主页的联系方式区(电话/微信/邮箱)、后台
5 个 tab 的 email 列**一直显示为空**——不是权限问题,是 RPC 直接抛错。

**根因**:`get_contact` / `admin_get_user_emails` 是 **plpgsql** 函数,声明
`RETURNS TABLE(... text ...)`,但 `users.phone` 是 `varchar(30)`、`email` 是
varchar。plpgsql 的 `RETURN QUERY` **严格校验行类型** → 抛
`42804: structure of query does not match function result type` → 整个 RPC
报错 → 前端拿到 null → 联系方式/邮箱全空。

**修复**:`RETURN QUERY SELECT u.phone::text, u.wechat::text, u.email::text …`
(把列强制转成声明的类型)。

**排查结论**:全量核过所有 plpgsql `RETURN QUERY` 函数,只有这 2 个中招,已修;
`admin_search_user_ids` 返回 uuid(匹配),`LANGUAGE sql` 的函数(get_my_contact
等)会隐式转 varchar→text 不报错。无遗漏。

**教训**(纳入规矩):
1. 建 RPC 必测**"成功返回真数据"**那条路径,不能只测权限拒绝——这次就是漏了。
2. `RETURN QUERY` 里列一律 `::` 转成声明类型,别赌 varchar/text 自动匹配。
3. 上线前对所有对外 RPC 跑一次 smoke(合法参数调一下看返不返回)。

## 4e. users 表宽读收口(第二轮 PII,migration 20260711120003–120006)

**触发**:复核"我的主页"取数路径时发现——PII 收口(4b/H2）当初**只 REVOKE 了
phone/wechat/email**,users 表**其余所有列对登录客户端仍开放**。用
`has_column_privilege('authenticated','public.users',col,'SELECT')` 逐列核,证实
任何登录客户端可 `select ... from users` 批量抓取,包括:

| 列 | 处理 | 迁移 |
|---|---|---|
| 🔴🔴 `password_hash` | REVOKE(前端 0 引用) | `...120003` |
| 🔴 `verification_doc_url` | REVOKE(证件文档) | `...120003` |
| 🔴 `certifications` | REVOKE | `...120003` |
| 🟠 `referred_by_code`(邀请关系图) | REVOKE(前端只写不读) | `...120004` |
| 🔴 `credit_penalty`(信用分,公开信任信号) | 移进 `public_profiles` 视图 + REVOKE base 列;前端改从视图读 | `...120005` |
| `notification_prefs`(私密设置) | `get_my_notification_prefs()` RPC + REVOKE | `...120006` |

**判定保留 true（可读）的列**:name/avatar/bio/social_links/skill_tags/business_type/
membership_level/business_verified/avg_reply_hours/is_online/last_seen_at/created_at/
phone_verified/is_email_verified/qualification_note(公开资料)、id_verified/
verification_status(认证徽章)、qualification_images(已决定公开+提示)、
online_lat/online_lng(C4 已偏移)、referral_code/role/membership_expires_at(低危)。

**核对方式**:`has_column_privilege` 逐列查,改后复核 8 个敏感列全 false。
**教训**:列级 REVOKE 要**枚举全表**核 `has_column_privilege`,别只挡"想到的那几列"。

## 5. 已核对、判定安全(未改)

- `inquiries` 未加入 realtime publication(不会经 Realtime 泄露)
- 根目录 `.env` 未含 service_role,不进前端 bundle;`.gitignore` 已忽略 `.env*`(仅 `.env.example` 入库)
- storage `avatars` 桶 INSERT 策略自带 owner 校验,不受路径劫持影响

---

## 方法论备忘

1. **改一次 RLS,就 `pg_policies` 核一次**——不信任盲扫迁移。
2. 列权限是**角色级**的,无法按行遮列 → 敏感列走 SECURITY DEFINER RPC + REVOKE。
3. 限流账本要用**只追加表**,别和会被业务逻辑删改的表复用。
4. 限流一律 **fail-open**,日志故障绝不阻断真实用户。
5. impersonation 测试模板:
   ```sql
   begin;
     set local role authenticated;
     set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
     <query>;
   rollback;
   ```
