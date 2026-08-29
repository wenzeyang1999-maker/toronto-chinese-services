// ─── 平台实时数据条 ───────────────────────────────────────────────────────────
// 首页显眼位置展示:注册用户 / 入驻服务商 / 在线接单 / 收录商家。
// 冷启动增强活跃感与可信度(数据来自公开 RPC platform_stats)。
import { useEffect, useState } from 'react'
import { Users, Store, Radio, BookMarked } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface Stats {
  users_total: number
  providers_total: number
  online_total: number
  directory_total: number
}

export default function HomeStatsBar() {
  const [s, setS] = useState<Stats | null>(null)

  useEffect(() => {
    supabase.rpc('platform_stats').then(({ data }) => {
      if (data) setS(data as Stats)
    })
  }, [])

  const items = [
    { icon: <Users size={15} />,      label: '注册用户', value: s?.users_total,     color: 'text-blue-600' },
    { icon: <Store size={15} />,      label: '入驻服务商', value: s?.providers_total, color: 'text-primary-600' },
    { icon: <Radio size={15} />,      label: '在线接单', value: s?.online_total,     color: 'text-emerald-600', live: true },
    { icon: <BookMarked size={15} />, label: '收录商家', value: s?.directory_total,  color: 'text-amber-600' },
  ]

  return (
    <div className="grid grid-cols-4 gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-3 shadow-sm">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col items-center gap-0.5 text-center">
          <span className={`inline-flex items-center gap-1 ${it.color}`}>
            {it.live && s && s.online_total > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
            {it.icon}
          </span>
          <span className="text-lg font-extrabold text-gray-900 tabular-nums leading-none mt-0.5">
            {it.value ?? '—'}
          </span>
          <span className="text-[11px] text-gray-400 leading-none">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
