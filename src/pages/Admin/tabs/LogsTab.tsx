// ─── Admin · Operation Logs tab ──────────────────────────────────────────────
// Self-contained: owns its own state and loads audit logs on mount.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { type AuditLogRow, ADMIN_ACTION_LABEL } from '../types'
import { renderAuditDetails } from '../auditFormat'
import { useAdminContext } from '../AdminContext'
import { fetchEmails } from '../adminEmails'

export default function LogsTab() {
  const { showNotice } = useAdminContext()
  const [auditLogs,       setAuditLogs]       = useState<AuditLogRow[]>([])
  const [logSearch,       setLogSearch]       = useState('')
  const [logActionFilter, setLogActionFilter] = useState<'all' | string>('all')
  const [logDateFrom,     setLogDateFrom]     = useState('')
  const [logDateTo,       setLogDateTo]       = useState('')

  async function loadAuditLogs() {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('id, action_type, target_type, target_id, details, created_at, actor:actor_id(id, name)')
      .order('created_at', { ascending: false })
      .limit(80)
    if (error) {
      showNotice('error', `加载操作日志失败：${error.message}`)
      return
    }
    const rows = (data ?? []).map((row: any) => ({
      ...row,
      details: row.details ?? {},
      actor: Array.isArray(row.actor) ? row.actor[0] : row.actor,
    }))
    const emails = await fetchEmails(rows.map((r: any) => r.actor?.id))
    setAuditLogs(rows.map((r: any) => (
      r.actor ? { ...r, actor: { ...r.actor, email: emails.get(r.actor.id) ?? '' } } : r
    )))
  }

  useEffect(() => {
    void loadAuditLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredAuditLogs = auditLogs.filter((log) => {
    const actionMatch = logActionFilter === 'all' || log.action_type === logActionFilter
    if (!actionMatch) return false

    const logDate = log.created_at.slice(0, 10)
    if (logDateFrom && logDate < logDateFrom) return false
    if (logDateTo && logDate > logDateTo) return false

    const keyword = logSearch.trim().toLowerCase()
    if (!keyword) return true

    const haystack = [
      ADMIN_ACTION_LABEL[log.action_type] ?? log.action_type,
      log.action_type,
      log.target_type,
      log.target_id ?? '',
      log.actor?.name ?? '',
      log.actor?.email ?? '',
      JSON.stringify(log.details ?? {}),
    ].join(' ').toLowerCase()

    return haystack.includes(keyword)
  })

  const logActionOptions = Array.from(new Set(auditLogs.map(log => log.action_type)))

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 flex-wrap">
        <input
          value={logSearch}
          onChange={e => setLogSearch(e.target.value)}
          placeholder="搜索动作、对象、操作者、详情"
          className="flex-1 min-w-[220px] text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
        />
        <select
          value={logActionFilter}
          onChange={e => setLogActionFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        >
          <option value="all">全部动作</option>
          {logActionOptions.map(action => (
            <option key={action} value={action}>
              {ADMIN_ACTION_LABEL[action] ?? action}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={logDateFrom}
          onChange={e => setLogDateFrom(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        />
        <input
          type="date"
          value={logDateTo}
          onChange={e => setLogDateTo(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        />
        <button onClick={loadAuditLogs}
          className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
          刷新
        </button>
      </div>
      <div className="text-xs text-gray-400 px-1">匹配到 {filteredAuditLogs.length} 条日志</div>
      {filteredAuditLogs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-400">暂无操作日志</p>
        </div>
      ) : filteredAuditLogs.map(log => (
        <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">
              {ADMIN_ACTION_LABEL[log.action_type] ?? log.action_type}
            </span>
            <span className="text-xs text-gray-400 ml-auto">{log.created_at.slice(0, 16).replace('T', ' ')}</span>
          </div>
          <p className="text-xs text-gray-500">
            操作者：{log.actor?.name ?? '管理员'}{log.actor?.email ? ` · ${log.actor.email}` : ''}
          </p>
          <p className="text-xs text-gray-500">
            对象：{log.target_type}{log.target_id ? ` · ${log.target_id}` : ''}
          </p>
          {renderAuditDetails(log.details)}
        </div>
      ))}
    </motion.div>
  )
}
