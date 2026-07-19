// ─── Admin · User feedback tab ───────────────────────────────────────────────
// Reads the shared `feedback` table (submitted from the Profile「联系我们」card):
// 提交建议 / 举报投诉 / 寻求合作. Admins triage via status: open → reviewing →
// resolved / dismissed.
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, ShieldAlert, Handshake, MessageSquare } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAdminContext } from '../AdminContext'

type FeedbackType = 'suggestion' | 'complaint' | 'report' | 'partner'
type FeedbackStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

interface FeedbackRow {
  id: string
  user_id: string | null
  type: FeedbackType
  report_type: 'user' | 'service' | 'post' | null
  target: string | null
  reason_tag: string | null
  detail: string | null
  status: FeedbackStatus
  created_at: string
  submitter?: { name: string | null } | null
}

const TYPE_META: Record<FeedbackType, { label: string; icon: typeof Lightbulb; color: string; bg: string }> = {
  suggestion: { label: '建议',    icon: Lightbulb,   color: 'text-amber-600',   bg: 'bg-amber-50' },
  complaint:  { label: '投诉',    icon: MessageSquare, color: 'text-orange-600', bg: 'bg-orange-50' },
  report:     { label: '举报',    icon: ShieldAlert, color: 'text-rose-600',    bg: 'bg-rose-50' },
  partner:    { label: '合作',    icon: Handshake,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
}

const STATUS_FILTERS: { key: FeedbackStatus | 'all'; label: string }[] = [
  { key: 'open',      label: '待处理' },
  { key: 'reviewing', label: '处理中' },
  { key: 'resolved',  label: '已解决' },
  { key: 'dismissed', label: '已忽略' },
  { key: 'all',       label: '全部' },
]

const REPORT_TYPE_LABEL = { user: '用户', service: '服务', post: '帖子' } as const

export default function FeedbackTab() {
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [rows, setRows]     = useState<FeedbackRow[]>([])
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('open')

  const load = useCallback(async () => {
    let q = supabase
      .from('feedback')
      .select('id, user_id, type, report_type, target, reason_tag, detail, status, created_at, submitter:user_id(name)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filter !== 'all') q = q.eq('status', filter)
    const { data, error } = await q
    if (error) { showNotice('error', `加载反馈失败：${error.message}`); return }
    setRows((data ?? []).map((r: any) => ({
      ...r,
      submitter: Array.isArray(r.submitter) ? r.submitter[0] : r.submitter,
    })))
  }, [filter, showNotice])

  useEffect(() => { void load() }, [load])

  async function setStatus(id: string, status: FeedbackStatus, doneText: string) {
    setActing(id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
      if (error) throw error
    }, doneText)
    // If viewing a filtered list, drop the row that no longer matches; else update it
    if (ok !== null) {
      setRows(prev => filter === 'all'
        ? prev.map(r => r.id === id ? { ...r, status } : r)
        : prev.filter(r => r.id !== id))
    }
    setActing(null)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === f.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {f.label}
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-auto">共 <strong className="text-gray-800">{rows.length}</strong> 条</span>
        <button onClick={load}
          className="px-3 py-1.5 border border-gray-200 text-xs text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          刷新
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-400">暂无反馈</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const meta = TYPE_META[r.type] ?? TYPE_META.suggestion
            const Icon = meta.icon
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                    <Icon size={12} /> {meta.label}
                  </span>
                  {r.type === 'report' && r.report_type && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {REPORT_TYPE_LABEL[r.report_type]}：{r.target || '—'}
                    </span>
                  )}
                  {r.reason_tag && (
                    <span className="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">{r.reason_tag}</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 16).replace('T', ' ')}</span>
                </div>

                {/* Detail */}
                {r.detail && (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-3">{r.detail}</p>
                )}

                {/* Submitter + status */}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>提交人：{r.submitter?.name ?? (r.user_id ? r.user_id.slice(0, 8) : '匿名')}</span>
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {STATUS_FILTERS.find(s => s.key === r.status)?.label ?? r.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {r.status !== 'reviewing' && r.status !== 'resolved' && (
                    <button onClick={() => setStatus(r.id, 'reviewing', '已标记处理中')} disabled={!!acting}
                      className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50">
                      {acting === r.id ? '处理中…' : '标记处理中'}
                    </button>
                  )}
                  <button onClick={() => setStatus(r.id, 'resolved', '已标记解决')} disabled={!!acting}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors disabled:opacity-50">
                    标记已解决
                  </button>
                  <button onClick={() => setStatus(r.id, 'dismissed', '已忽略')} disabled={!!acting}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 ml-auto">
                    忽略
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
