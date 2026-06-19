// ─── Admin · User complaints tab ─────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Flag, Ban } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type ContentReportRow } from '../types'
import { useAdminContext } from '../AdminContext'

export default function UserReportsTab() {
  const navigate = useNavigate()
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [userReports,   setUserReports]   = useState<ContentReportRow[]>([])
  const [penaltyInputs, setPenaltyInputs] = useState<Record<string, string>>({})

  async function loadUserReports() {
    const { data, error } = await supabase
      .from('content_reports')
      .select('id, content_type, content_id, content_title, reason, status, created_at, reporter:reporter_id(id, name)')
      .eq('status', 'pending')
      .eq('content_type', 'user')
      .order('created_at', { ascending: false })
    if (error) {
      showNotice('error', `加载用户投诉失败：${error.message}`)
      return
    }
    if (data) {
      setUserReports(data.map((r: any) => ({
        ...r,
        reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
      })))
    }
  }

  async function dismissUserReport(reportId: string) {
    setActing(reportId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase
        .from('content_reports')
        .update({ status: 'dismissed' })
        .eq('id', reportId)
      if (error) throw error
    }, '已忽略投诉')
    if (ok !== null) setUserReports(prev => prev.filter(r => r.id !== reportId))
    setActing(null)
  }

  async function applyUserPenalty(report: ContentReportRow) {
    const pts = parseInt(penaltyInputs[report.id] ?? '1', 10)
    if (isNaN(pts) || pts < 1 || pts > 10) {
      showNotice('error', '扣分范围 1–10')
      return
    }
    setActing(report.id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_apply_credit_penalty', {
        target_user_id: report.content_id,
        penalty_pts: pts,
      })
      if (error) throw error
      const { error: e2 } = await supabase
        .from('content_reports')
        .update({ status: 'resolved' })
        .eq('id', report.id)
      if (e2) throw e2
    }, `已扣 ${pts} 分`)
    if (ok !== null) setUserReports(prev => prev.filter(r => r.id !== report.id))
    setActing(null)
  }

  async function banUserFromReport(report: ContentReportRow) {
    setActing(report.id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_user_role', {
        target_user_id: report.content_id,
        new_role: 'banned',
      })
      if (error) throw error
      const { error: e2 } = await supabase
        .from('content_reports')
        .update({ status: 'resolved' })
        .eq('id', report.id)
      if (e2) throw e2
    }, '账号已封禁')
    if (ok !== null) setUserReports(prev => prev.filter(r => r.id !== report.id))
    setActing(null)
  }

  useEffect(() => {
    void loadUserReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 flex-1">
          待处理投诉 <strong className="text-red-600">{userReports.length}</strong>
        </span>
        <button onClick={loadUserReports}
          className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
          刷新
        </button>
      </div>
      {userReports.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-400">暂无待处理用户投诉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {userReports.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2">
                <Flag size={14} className="text-red-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-500">用户投诉</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{r.reason}</span>
                <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
              </div>
              {/* Reported user */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm font-semibold text-gray-800">{r.content_title}</p>
                <p className="text-xs text-gray-400 mt-0.5">用户 ID：{r.content_id}</p>
                <button
                  onClick={() => navigate(`/provider/${r.content_id}`)}
                  className="text-xs text-primary-600 underline mt-1"
                >
                  查看主页
                </button>
              </div>
              <p className="text-xs text-gray-400">投诉人：{r.reporter?.name ?? '匿名'}</p>
              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Dismiss */}
                <button
                  onClick={() => dismissUserReport(r.id)}
                  disabled={!!acting}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {acting === r.id ? '处理中…' : '忽略'}
                </button>
                {/* Credit deduction */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1} max={10}
                    value={penaltyInputs[r.id] ?? '1'}
                    onChange={e => setPenaltyInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                    className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    onClick={() => applyUserPenalty(r)}
                    disabled={!!acting}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors disabled:opacity-50"
                  >
                    扣信用分
                  </button>
                </div>
                {/* Ban */}
                <button
                  onClick={() => {
                    if (!confirm(`确定封号该用户？封号后无法登录，可在「用户管理」搜索后解封。`)) return
                    banUserFromReport(r)
                  }}
                  disabled={!!acting}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                >
                  <Ban size={12} /> 封号
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
