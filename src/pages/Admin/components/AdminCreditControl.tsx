import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from '../../../lib/toast'

// 后台：查看某用户精确信用分 + 明细 + 手动设置扣分（0-100，可清零）。
const TIER: Record<string, string> = {
  good: '🟢 优质', ok: '🔵 良好', new: '🆕 新用户', restricted: '⛔ 受限',
}

interface Trust {
  score: number; tier: string; valid_complaints: number
  warn: boolean; restricted: boolean; completed: number; good_reviews: number
}

export default function AdminCreditControl({ userId }: { userId: string }) {
  const [t, setT] = useState<Trust | null>(null)
  const [pen, setPen] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.rpc('user_trust', { p_user: userId }).maybeSingle()
    if (data) setT(data as unknown as Trust)
  }
  useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId])

  async function setPenalty() {
    const v = parseInt(pen, 10)
    if (isNaN(v) || v < 0 || v > 100) { toast('扣分需 0-100', 'error'); return }
    setSaving(true)
    const { error } = await supabase.rpc('admin_set_credit_penalty', { p_user: userId, p_value: v })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('已更新扣分 ✓', 'success'); setPen(''); void load()
  }

  if (!t) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 text-xs space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-gray-800">信用分 {t.score}</span>
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
          {TIER[t.tier] ?? t.tier}{t.warn ? ' ⚠️多次投诉' : ''}
        </span>
        <span className="text-gray-400">完工 {t.completed} · 好评 {t.good_reviews} · 有效投诉 {t.valid_complaints}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-400">手动扣分 (0-100)：</span>
        <input value={pen} onChange={(e) => setPen(e.target.value)} placeholder="0" inputMode="numeric"
          className="w-16 border border-gray-200 rounded px-2 py-1 text-center" />
        <button onClick={setPenalty} disabled={saving}
          className="px-3 py-1 rounded-lg bg-gray-800 text-white font-semibold disabled:opacity-50">设置</button>
      </div>
    </div>
  )
}
