# 墙1 · 订单/成交状态机 — 设计方案

> 目标:让平台从"信息黄页"升级为"交易平台"。有了成交记录,才能:
> **评价绑成交**(防刷评)· **商家战绩**(已成交 N 单)· **GMV/复购**(数据)· 后续**变现**(墙2 支付的地基)。
>
> 现状:无订单概念。评价可随便刷(不绑成交)。商家战绩无法自动统计。

---

## 一、核心模型选择(最关键)

平台的真实成交发生在**线下/聊天里**(搬家、保洁这类,客户先联系再谈)。所以订单不是"下单付款",而是"**确认这笔生意成交了**"。三种模型:

| 模型 | 谁记录 | 可信度 | 适合 |
|---|---|---|---|
| **A 双向确认(推荐)** | 一方发起「标记成交」,另一方确认 | ⭐⭐⭐ 双方都认=真成交 | 评价绑成交的最佳地基 |
| B 商家单方标记 | 商家点「已成交」 | ⭐ 商家可刷单 | 简单但不可信 |
| C 客户下单预约 | 客户在服务页「预约下单」,商家接单 | ⭐⭐ 像 booking | 正式服务,但本地零工少这么用 |

**推荐 A(双向确认)**:任一方点「标记成交」→ 生成待确认订单 → 对方收到通知去确认 → 确认后 = 成交。这样**评价只能给"双方确认的成交"** → 评价可信;商家战绩=确认成交数,不能刷。

---

## 二、状态机(MVP)

```
                ┌────────── 对方拒绝 / 发起方撤销 ──────────┐
                ▼                                          │
[pending] ──对方确认──▶ [confirmed] ──(可选)标记完成──▶ [completed] ──双方可评价
  发起待确认              成交确认                          服务完成
                │
             [cancelled]
```

MVP 可先合并 `confirmed` = `completed`(确认即成交即可评价),等需要再拆"进行中/完成"。

**MVP 状态**:`pending`(待确认) · `confirmed`(成交) · `cancelled`(取消/拒绝)。

---

## 三、数据表

```sql
CREATE TABLE orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 客户
  provider_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 商家
  service_id   uuid REFERENCES services(id) ON DELETE SET NULL,       -- 来自哪个服务(可空)
  inquiry_id   uuid REFERENCES inquiries(id) ON DELETE SET NULL,      -- 来自哪个询价(可空)
  category_id  text,
  title        text,            -- 成交内容摘要(如"小型搬家")
  amount       numeric,         -- 成交金额(选填,手填;为 GMV 打基础)
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','confirmed','cancelled','completed')),
  created_by   uuid NOT NULL,   -- 谁发起的(client 或 provider)
  note         text,
  confirmed_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT orders_no_self CHECK (client_id <> provider_id)
);
-- RLS:仅 client/provider 双方可读写自己的订单;状态流转用 SECURITY DEFINER RPC 控制
--   (发起、确认、取消各一个 RPC,校验身份 + 合法状态迁移)。
```

**评价绑成交**:`reviews` 加 `order_id uuid REFERENCES orders(id)`;插入评价时校验"存在一条 confirmed 且属于该 reviewer 的订单"(RPC 或 trigger)。旧评价 order_id 为 null(遗留,保留)。

**商家战绩**:`confirmed 订单数` = 战绩条"已成交 N 单";`sum(amount)` = GMV(内部)。用视图或 RPC 算,展示在商家主页。

---

## 四、入口与流程(UI)

**发起成交**(「标记成交」按钮出现在这些地方):
- 询价选定商家后 / 站内对话里(客户或商家点)
- 服务详情页(客户点"已找 TA 成交")

**确认**:对方收到通知(红点 + 通知)→ 在「我的订单」里点确认/拒绝。

**新页面**:「我的订单」(客户看自己发起/参与的;商家看接的成交)——列表 + 状态 + 确认/评价按钮。挂在 账号页(客户+商家两个视角)。

**评价**:确认成交后,「我的订单」里出现"评价"按钮 → 走现有评价流程,但带 order_id。

**商家主页**:加战绩条"已成交 N 单 · 好评率 X%"。

---

## 五、分阶段落地(建议)

| 阶段 | 内容 | 价值 |
|---|---|---|
| **P1(先做)** | orders 表 + 双向确认(发起/确认/取消 RPC)+ 「我的订单」页 + 商家主页"已成交 N 单" | 成交闭环 + 战绩 |
| **P2** | 评价绑成交(reviews.order_id + 只有 confirmed 订单可评)| 防刷评、评价可信 |
| **P3** | amount/GMV 统计 + 数据看板;之后接墙2 支付,订单可线上付款 | 变现地基 |

**先做 P1**——最小可用的成交闭环。P2 评价绑定是产品体验的转变(客户只能评已成交的),单独一步。P3 等要变现再上。

---

## 六、需要你拍板的关键决策

1. **成交模型**:双向确认(推荐)/ 商家单方标记 / 客户下单预约?
2. **金额**:成交时填金额吗(选填)?还是先不碰金额(纯记成交)?
3. **评价绑定**:现在就强制"只有成交才能评"(改现有评价流程),还是先只建订单、评价照旧、下一步再绑?
4. **MVP 范围**:就按 P1(订单+确认+我的订单+战绩)先落地?
