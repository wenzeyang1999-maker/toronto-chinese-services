// ─── 华邻 会员及盈利体系 · 单一事实源（Single Source of Truth）──────────────
// 完整方案见 docs/华邻会员及盈利体系（华邻版 V1）.md
//
// 档位命名与数据库一致：L1 普通 / L2 黄金 / L3 至尊（DB 字段 users.membership_level）。
//
// ⚠️ 分清两层职责，别重复造：
//   · 【已上线·数据库负责】会员等级的授予 / 到期 / 推荐加时 / 发帖额度：
//       - 新用户自动 L2 三个月：handle_new_user() 触发器
//       - 每 10 个成功推荐 → L2 +30 天：grant_referral_reward() 触发器
//       - 同时在架帖子上限 L1=1/L2=3/L3=10：enforce_member_quota() 触发器
//       - 生效等级（含到期回落 L1）：effective_member_level()
//   · 【未上线·本文件负责】收费/邻豆/抢单额度 —— 由 MONETIZATION_ENABLED 关着。
//
// ⚠️ 启动阶段：付费机制「已建骨架、未上线」。
//    MONETIZATION_ENABLED = false 时：抢单不计费、无付费墙。
//    线上收款方案确定后，改这一处开关 + 按文档 §六 分期接入即可全局开启。
//
// 三条硬原则（写死，收费不可妥协）：
//   1. 付费只解除「免费额度」，永远不解除「信用受限」。受限用户付费也不能抢单。
//   2. 认证徽章永远免费显示，绝不靠钱解锁（徽章有无只看后台核验字段）。
//   3. 匹配排序主键 = 信用分 + 口碑；付费只做「同信用档位内」加权，不跨档覆盖。

// ─── 总开关（仅管付费，不管上面已上线的会员等级/额度）───────────────────────
// 启动阶段：false。收款接入并回归测试三条硬原则后，再改 true。
export const MONETIZATION_ENABLED = false

// 与 DB users.membership_level 对齐。
export type MembershipTier = 'L1' | 'L2' | 'L3'

// 免费档每月「抢单/查看客户精准联系方式」额度（仅在 MONETIZATION_ENABLED 时生效）。
export const FREE_GRAB_QUOTA_PER_MONTH = 3

// ─── 计费动作：只对「变现动作」收费，其余永久免费 ────────────────────────────
// 消耗额度/邻豆的动作（其余：浏览、搜索、发需求、AI 解析、主动联系不发帖 —— 永久免费）。
export const BILLABLE_ACTIONS = ['grab_order', 'reveal_client_contact', 'boost_post'] as const
export type BillableAction = (typeof BILLABLE_ACTIONS)[number]

// ─── 会员等级定义 ────────────────────────────────────────────────────────────
export interface TierDef {
  tier: MembershipTier
  name: string
  audience: string
  monthlyPrice: number | null   // null = 免费；单位 CAD（规划值，未上线）
  yearlyPrice: number | null
  perUsePrice: number | null    // 不订月费时的单次价（邻豆）
  grabQuota: number | 'unlimited'
  socialLinks: boolean          // 社媒外链跳转（付费权益，非信任本身）
  maxCards: number              // 同时在架名片上限，与 DB enforce_member_quota 保持一致
  cardValidDays: number
  // exposureBoost：同档内曝光加权（0=无），仅在同信用档内生效，绝不跨档。
  exposureBoost: 0 | 1 | 2
}

export const TIERS: Record<MembershipTier, TierDef> = {
  L1: {
    tier: 'L1', name: '普通会员', audience: 'C 端用户 / 试水新手师傅',
    monthlyPrice: null, yearlyPrice: null, perUsePrice: 2.99,
    grabQuota: FREE_GRAB_QUOTA_PER_MONTH,
    socialLinks: false, maxCards: 1, cardValidDays: 7, exposureBoost: 0,
  },
  L2: {
    tier: 'L2', name: '黄金会员', audience: '个人师傅 / 兼职个体户',
    monthlyPrice: 19.99, yearlyPrice: 199, perUsePrice: 2.99,
    grabQuota: 'unlimited',
    socialLinks: true, maxCards: 3, cardValidDays: 30, exposureBoost: 1,
  },
  L3: {
    tier: 'L3', name: '至尊会员', audience: '专业公司 / 团队商户',
    monthlyPrice: 49.99, yearlyPrice: 499, perUsePrice: null,
    grabQuota: 'unlimited',
    socialLinks: true, maxCards: 10, cardValidDays: 3650, exposureBoost: 2,
  },
}

// ─── 邻豆（平台内预付点数，SaaS 额度，非代收订单钱款）──────────────────────
export const COIN_PRICING = {
  perGrab: 2.99,          // 单次抢单
  boostPost3d: 4.99,      // 商业帖置顶 3 天
  topups: [
    { pay: 10, bonus: 2 },   // 充 $10 赠 $2
    { pay: 50, bonus: 15 },  // 充 $50 赠 $15
  ],
  // 无果退费：抢单时冻结（hold），成交实扣，客户放弃/无果则解冻退回。
  refundOnNoDeal: true,
} as const

// ─── 权益解析 ────────────────────────────────────────────────────────────────
export interface Entitlements {
  grabQuota: number | 'unlimited'
  socialLinks: boolean
  maxCards: number
  cardValidDays: number
  exposureBoost: 0 | 1 | 2
}

// 启动阶段（MONETIZATION_ENABLED=false）：抢单无限、无付费加权。
// 上线后：按真实会员等级返回权益。
export function resolveEntitlements(tier: MembershipTier = 'L1'): Entitlements {
  const t = TIERS[tier]
  if (!MONETIZATION_ENABLED) {
    return {
      grabQuota: 'unlimited',   // 付费未上线，抢单不计费
      socialLinks: t.socialLinks,
      maxCards: t.maxCards,
      cardValidDays: t.cardValidDays,
      exposureBoost: 0,         // 启动阶段不做任何付费加权，纯按信用+口碑排序
    }
  }
  return {
    grabQuota: t.grabQuota,
    socialLinks: t.socialLinks,
    maxCards: t.maxCards,
    cardValidDays: t.cardValidDays,
    exposureBoost: t.exposureBoost,
  }
}

// ─── 抢单判定链（信用先于付费，顺序不可颠倒）─────────────────────────────────
// 接入抢单入口时照此顺序调用。canParticipate 来自信用体系 can_participate()。
export type GrabDecision =
  | { allow: true; reason: 'ok' }
  | { allow: false; reason: 'credit_restricted' }   // 信用受限：付费也不能过（原则 1）
  | { allow: false; reason: 'quota_exhausted' }     // 额度用尽：引导购买/升级

export function decideGrab(params: {
  canParticipate: boolean          // 1. 信用门槛（最先，付费不参与）
  tier?: MembershipTier            // 2. 会员等级（来自 effective_member_level）
  freeGrabsUsedThisMonth?: number  // 3. 本月已用免费次数
  coinBalance?: number             // 3. 邻豆余额
}): GrabDecision {
  // 1. 信用门槛永远最先判：受限直接拦截，付费状态完全不参与（原则 1）。
  if (!params.canParticipate) return { allow: false, reason: 'credit_restricted' }

  // 2. 启动阶段：总开关关闭 → 无限放行，不计费。
  if (!MONETIZATION_ENABLED) return { allow: true, reason: 'ok' }

  // 3. 额度：付费档无限；免费档看剩余免费次数或邻豆。
  const ent = resolveEntitlements(params.tier ?? 'L1')
  if (ent.grabQuota === 'unlimited') return { allow: true, reason: 'ok' }
  const used = params.freeGrabsUsedThisMonth ?? 0
  if (used < ent.grabQuota) return { allow: true, reason: 'ok' }
  if ((params.coinBalance ?? 0) > 0) return { allow: true, reason: 'ok' }
  return { allow: false, reason: 'quota_exhausted' }
}
