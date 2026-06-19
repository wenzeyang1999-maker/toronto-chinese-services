// ─── Admin · Review reports tab ──────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Flag, CheckCircle2, Star, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type ReportRow, REASON_LABEL } from '../types'
import { useAdminContext } from '../AdminContext'

export default function ReportsTab() {
  const navigate = useNavigate()
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [reports, setReports] = useState<ReportRow[]>([])

  async function loadReports() {
    const { data, error } = await supabase
      .from('review_reports')
      .select(`
        id, reason, status, created_at,
        review:review_id(id, rating, comment, service:service_id(id, title)),
        reporter:reporter_id(id, name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) {
      showNotice('error', `加载举报列表失败：${error.message}`)
      return
    }
    if (data) {
      setReports(data.map((r: any) => ({
        ...r,
        review:   Array.isArray(r.review)   ? r.review[0]   : r.review,
        reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
      })))
    }
  }

  async function dismiss(reportId: string) {
    setActing(reportId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_dismiss_review_report', { report_id: reportId })
      if (error) throw error
    }, '已忽略举报')
    if (ok !== null) {
      setReports(prev => prev.filter(r => r.id !== reportId))
    }
    setActing(null)
  }

  async function removeReview(report: ReportRow) {
    if (!report.review) return
    setActing(report.id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_remove_review', {
        review_id: report.review!.id,
        report_id: report.id,
      })
      if (error) throw error
    }, '评价已删除')
    if (ok !== null) {
      setReports(prev => prev.filter(r => r.review?.id !== report.review?.id))
    }
    setActing(null)
  }

  useEffect(() => {
    void loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return reports.length === 0 ? (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
      <CheckCircle2 size={36} className="text-green-300 mx-auto mb-3" />
      <p className="text-sm text-gray-400">暂无待处理举报</p>
    </div>
  ) : (
    <div className="space-y-3">
      {reports.map(r => (
        <motion.div key={r.id}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
        >
          {/* Report meta */}
          <div className="flex items-center gap-2 mb-3">
            <Flag size={14} className="text-red-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-500">{REASON_LABEL[r.reason] ?? r.reason}</span>
            <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
          </div>

          {/* Review content */}
          {r.review ? (
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-semibold text-gray-700">{r.review.rating} 星</span>
                {r.review.service?.id && (
                  <button onClick={() => navigate(`/service/${r.review!.service!.id}`)}
                    className="text-xs text-primary-600 underline ml-auto">
                    {r.review.service.title}
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{r.review.comment || '（无文字评价）'}</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-3">评价已被删除</p>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 flex-1">
              举报人：{r.reporter?.name ?? '匿名'}
            </span>
            <button
              onClick={() => dismiss(r.id)}
              disabled={!!acting}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {acting === r.id ? '处理中…' : '忽略'}
            </button>
            {r.review && (
              <button
                onClick={() => removeReview(r)}
                disabled={!!acting}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Trash2 size={12} />删除评价
              </button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
