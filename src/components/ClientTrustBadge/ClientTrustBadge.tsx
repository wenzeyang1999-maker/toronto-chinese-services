import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// 综合可信度粗档位徽章 —— 可用于客户(师傅抢单前参考)或师傅。
// 数据来自 user_trust（认证 + 完工 + 口碑 - 有效投诉 → 分数/档位/门槛）。
const TIER: Record<string, { label: string; cls: string }> = {
  good:       { label: '✅ 优质',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ok:         { label: '✅ 良好',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  new:        { label: '🆕 新用户', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  restricted: { label: '⛔ 受限',   cls: 'bg-red-50 text-red-600 border-red-200' },
}

interface Trust { tier: string; warn: boolean; valid_complaints: number }

export default function ClientTrustBadge({ userId, className = '' }: { userId: string; className?: string }) {
  const [t, setT] = useState<Trust | null>(null)
  useEffect(() => {
    let alive = true
    supabase.rpc('user_trust', { p_user: userId }).maybeSingle()
      .then(({ data }) => { if (alive && data) setT(data as unknown as Trust) })
    return () => { alive = false }
  }, [userId])
  if (!t) return null
  // 多次投诉但未到受限 → 用警示样式覆盖
  const cfg = t.warn
    ? { label: `⚠️ 多次投诉(${t.valid_complaints})`, cls: 'bg-amber-50 text-amber-700 border-amber-200' }
    : (TIER[t.tier] ?? TIER.new)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls} ${className}`}>
      {cfg.label}
    </span>
  )
}
