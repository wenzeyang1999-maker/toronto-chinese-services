// ─── Admin · 数据后台(admin-only 数据检测)────────────────────────────────────
// 一页看全:注册/活跃(DAU/WAU/MAU)、内容量、业务流水(需求/对话/消息/成交/GMV)
// + 实时活动流水 feed。数据来自 admin-only RPC(admin_backend_metrics / admin_activity_feed)。
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Activity, UserPlus, Radio, MessageSquare, Search, HandCoins,
  Wrench, Briefcase, Home, ShoppingBag, Calendar, MessageCircle, RefreshCw,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'

type Metrics = Record<string, number | string>
interface FeedRow { kind: string; label: string; at: string }

const KIND_META: Record<string, { emoji: string; label: string; color: string }> = {
  signup:     { emoji: '🙋', label: '注册',   color: 'text-blue-600 bg-blue-50' },
  service:    { emoji: '🔧', label: '发服务', color: 'text-primary-600 bg-primary-50' },
  inquiry:    { emoji: '🔍', label: '需求',   color: 'text-amber-600 bg-amber-50' },
  order:      { emoji: '🤝', label: '成交',   color: 'text-emerald-600 bg-emerald-50' },
  community:  { emoji: '💬', label: '论坛',   color: 'text-rose-600 bg-rose-50' },
  job:        { emoji: '💼', label: '招聘',   color: 'text-purple-600 bg-purple-50' },
  secondhand: { emoji: '🛍️', label: '闲置',   color: 'text-orange-600 bg-orange-50' },
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  return `${Math.floor(s / 86400)} 天前`
}

export default function BackendTab() {
  const [m, setM]       = useState<Metrics | null>(null)
  const [feed, setFeed] = useState<FeedRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr]   = useState<string | null>(null)

  async function load() {
    setLoading(true); setErr(null)
    const [mRes, fRes] = await Promise.all([
      supabase.rpc('admin_backend_metrics'),
      supabase.rpc('admin_activity_feed', { p_limit: 40 }),
    ])
    if (mRes.error) { setErr(mRes.error.message); setLoading(false); return }
    setM(mRes.data as Metrics)
    if (!fRes.error && fRes.data) setFeed(fRes.data as FeedRow[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const n = (k: string) => Number(m?.[k] ?? 0)

  if (loading && !m) return <div className="text-center py-20 text-gray-400 text-sm">加载数据后台…</div>
  if (err) return (
    <div className="text-center py-16">
      <p className="text-sm text-red-500 mb-3">加载失败：{err}</p>
      <button onClick={load} className="text-xs text-primary-600 border border-primary-200 rounded-xl px-4 py-2">重试</button>
    </div>
  )

  // 大数字卡片(核心)
  const hero = [
    { icon: <Users size={18} />,     label: '注册用户',   value: n('users_total'), sub: `今日 +${n('users_1d')} · 7天 +${n('users_7d')}`, color: 'text-blue-600 bg-blue-50' },
    { icon: <Activity size={18} />,  label: '日活 DAU',   value: n('dau'),         sub: `周活 ${n('wau')} · 月活 ${n('mau')}`,          color: 'text-emerald-600 bg-emerald-50' },
    { icon: <Radio size={18} />,     label: '在线接单',   value: n('online_providers'), sub: '当前上线商家',                            color: 'text-green-600 bg-green-50' },
    { icon: <HandCoins size={18} />, label: '平台流水', value: '$0', sub: '会员/充值通道未开通', color: 'text-amber-600 bg-amber-50' },
  ]

  // 业务流水
  const biz = [
    { icon: <Search size={16} />,        label: '需求(询价)', value: n('inquiries_total'), sub: `7天 +${n('inquiries_7d')}` },
    { icon: <MessageSquare size={16} />, label: '对话',        value: n('conversations'),   sub: '' },
    { icon: <MessageCircle size={16} />, label: '消息',        value: n('messages_total'),  sub: `7天 +${n('messages_7d')}` },
    { icon: <HandCoins size={16} />,     label: '撮合成交额',   value: `$${n('gmv')}`,       sub: `${n('orders_done')} 单 · 用户间成交,非平台收入` },
  ]

  // 内容量
  const content = [
    { icon: <Wrench size={16} />,      label: '服务', value: n('services') },
    { icon: <Briefcase size={16} />,   label: '招聘', value: n('jobs') },
    { icon: <Home size={16} />,        label: '房源', value: n('properties') },
    { icon: <ShoppingBag size={16} />, label: '闲置', value: n('secondhand') },
    { icon: <Calendar size={16} />,    label: '活动', value: n('events') },
    { icon: <MessageCircle size={16} />, label: '论坛', value: n('community') },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">数据后台</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {m?.generated_at ? `更新于 ${new Date(String(m.generated_at)).toLocaleString('zh-CN')}` : ''}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 border border-primary-200 rounded-xl px-3 py-1.5 hover:bg-primary-50 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>

      {/* 核心大卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {hero.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color}`}>{c.icon}</span>
              <span className="text-xs text-gray-400">{c.label}</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{c.value}</p>
            <p className="text-[11px] text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 业务流水 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">业务流水</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {biz.map((c) => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center flex-shrink-0">{c.icon}</span>
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900 tabular-nums">{c.value}</p>
                <p className="text-[11px] text-gray-400 truncate">{c.label}{c.sub ? ` · ${c.sub}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 内容量 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">内容量</h3>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
          {content.map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <span className="inline-flex text-gray-400 mb-1">{c.icon}</span>
              <p className="text-lg font-bold text-gray-900 tabular-nums leading-none">{c.value}</p>
              <p className="text-[11px] text-gray-400 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 实时活动流水 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">实时活动流水</h3>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
          {!feed || feed.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">暂无活动</p>
          ) : feed.map((r, i) => {
            const meta = KIND_META[r.kind] ?? { emoji: '•', label: r.kind, color: 'text-gray-500 bg-gray-50' }
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${meta.color}`}>{meta.emoji}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${meta.color}`}>{meta.label}</span>
                <span className="text-sm text-gray-700 truncate flex-1">{r.label}</span>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(r.at)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
