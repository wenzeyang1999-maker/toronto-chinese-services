// ─── Credit Score ─────────────────────────────────────────────────────────────
// Simple v1: verification-only. 满分 10 分, 星级 = 分数 / 2.
// More dimensions (reviews, reply speed, account age) will be added once the
// platform has enough users / data.

export interface CreditInput {
  emailVerified:        boolean
  phoneVerified:        boolean
  idOrBusinessVerified: boolean
}

export interface CreditItem {
  label:  string
  points: number
  earned: boolean
  /** Optional deep-link to the page where the user can complete this item. */
  actionUrl?: string
}

export interface CreditResult {
  score:     number       // 0–10
  stars:     number       // 0–5 (score / 2, supports half stars)
  breakdown: CreditItem[]
}

const ITEMS: Array<Omit<CreditItem, 'earned'> & { key: keyof CreditInput }> = [
  { key: 'emailVerified',        label: '邮箱验证',        points: 3, actionUrl: '/profile?section=account' },
  { key: 'phoneVerified',        label: '手机验证',        points: 4, actionUrl: '/profile?section=verification' },
  { key: 'idOrBusinessVerified', label: '实名 / 商户认证', points: 3, actionUrl: '/profile?section=verification' },
]

export const CREDIT_MAX = 10

export function computeCreditScore(input: CreditInput): CreditResult {
  const breakdown: CreditItem[] = ITEMS.map((it) => ({
    label:     it.label,
    points:    it.points,
    earned:    input[it.key],
    actionUrl: it.actionUrl,
  }))
  const score = breakdown.reduce((s, i) => s + (i.earned ? i.points : 0), 0)
  return { score, stars: score / 2, breakdown }
}
