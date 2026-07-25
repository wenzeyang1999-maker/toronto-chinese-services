import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// 客户可信度粗档位 —— 给师傅在抢单/接单前参考（只给聚合信号，不泄露单条评价）。
// 数据来自 client_trust RPC（近30单加权的"师傅评客户"评分 + 档位）。
const TIER: Record<string, { label: string; cls: string }> = {
  good:    { label: '✅ 优质客户', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ok:      { label: '✅ 良好',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  new:     { label: '🆕 新用户',   cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  caution: { label: '⚠️ 需留意',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
}

interface Trust { tier: string; avg_rating: number; review_count: number }

export default function ClientTrustBadge({ clientId, className = '' }: { clientId: string; className?: string }) {
  const [t, setT] = useState<Trust | null>(null)
  useEffect(() => {
    let alive = true
    supabase.rpc('client_trust', { p_client: clientId }).maybeSingle()
      .then(({ data }) => { if (alive && data) setT(data as unknown as Trust) })
    return () => { alive = false }
  }, [clientId])
  if (!t) return null
  const cfg = TIER[t.tier] ?? TIER.new
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls} ${className}`}>
      {cfg.label}
      {t.review_count > 0 && <span className="opacity-80">· {Number(t.avg_rating).toFixed(1)}★({t.review_count})</span>}
    </span>
  )
}
