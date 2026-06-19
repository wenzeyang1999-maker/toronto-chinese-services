// ─── Admin · Content reports tab ─────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Flag, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type ContentReportRow, REASON_LABEL } from '../types'
import { useAdminContext } from '../AdminContext'

export default function CommunityReportsTab() {
  const navigate = useNavigate()
  const { acting, setActing, runAdminAction, showNotice } = useAdminContext()
  const [contentReports, setContentReports] = useState<ContentReportRow[]>([])

  async function loadContentReports() {
    const { data, error } = await supabase
      .from('content_reports')
      .select('id, content_type, content_id, content_title, reason, status, created_at, reporter:reporter_id(id, name)')
      .eq('status', 'pending')
      .neq('content_type', 'user')
      .order('created_at', { ascending: false })
    if (error) {
      showNotice('error', `加载内容举报失败：${error.message}`)
      return
    }
    if (data) {
      setContentReports(data.map((r: any) => ({
        ...r,
        reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
      })))
    }
  }

  async function dismissContentReport(reportId: string) {
    setActing(reportId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_dismiss_content_report', { p_report_id: reportId })
      if (error) throw error
    }, '已忽略举报')
    if (ok !== null) {
      setContentReports(prev => prev.filter(r => r.id !== reportId))
    }
    setActing(null)
  }

  async function removeReportedContent(report: ContentReportRow) {
    setActing(report.id)
    let rpcName = ''
    let rpcArgs: Record<string, string> = {}
    let successMsg = ''

    if (report.content_type === 'community_post') {
      rpcName = 'admin_remove_reported_post'
      rpcArgs = { p_report_id: report.id, p_post_id: report.content_id }
      successMsg = '已删除被举报帖子'
    } else if (report.content_type === 'community_comment') {
      rpcName = 'admin_remove_reported_comment'
      rpcArgs = { p_report_id: report.id, p_comment_id: report.content_id }
      successMsg = '已删除被举报评论'
    } else if (report.content_type === 'service') {
      rpcName = 'admin_remove_reported_service'
      rpcArgs = { p_report_id: report.id, p_service_id: report.content_id }
      successMsg = '服务已下架'
    } else if (report.content_type === 'secondhand') {
      rpcName = 'admin_remove_reported_secondhand'
      rpcArgs = { p_report_id: report.id, p_item_id: report.content_id }
      successMsg = '商品已删除'
    } else if (report.content_type === 'job') {
      rpcName = 'admin_remove_reported_job'
      rpcArgs = { p_report_id: report.id, p_job_id: report.content_id }
      successMsg = '招聘已下架'
    } else if (report.content_type === 'property') {
      rpcName = 'admin_remove_reported_property'
      rpcArgs = { p_report_id: report.id, p_property_id: report.content_id }
      successMsg = '房源已下架'
    } else if (report.content_type === 'event') {
      rpcName = 'admin_remove_reported_event'
      rpcArgs = { p_report_id: report.id, p_event_id: report.content_id }
      successMsg = '活动已下架'
    } else {
      setActing(null)
      return
    }

    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc(rpcName, rpcArgs)
      if (error) throw error
    }, successMsg)

    if (ok !== null) {
      setContentReports(prev => prev.filter(r =>
        !(r.content_type === report.content_type && r.content_id === report.content_id)
      ))
    }
    setActing(null)
  }

  useEffect(() => {
    void loadContentReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 flex-1">
          待处理举报 <strong className="text-orange-600">{contentReports.length}</strong>
        </span>
        <button onClick={loadContentReports}
          className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
          刷新
        </button>
      </div>
      {contentReports.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-400">暂无待处理内容举报</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contentReports.map(r => {
            const typeLabel: Record<string, string> = {
              community_post: '社区帖子', community_comment: '社区评论',
              service: '服务', secondhand: '二手', job: '招聘',
              property: '房产', event: '活动',
            }
            const actionLabel: Record<string, string> = {
              community_post: '删除帖子', community_comment: '删除评论',
              service: '下架服务', secondhand: '删除商品', job: '删除招聘',
              property: '删除房源', event: '删除活动',
            }
            const viewPath: Record<string, string> = {
              community_post: `/community/${r.content_id}`,
              service: `/service/${r.content_id}`,
              secondhand: `/secondhand/${r.content_id}`,
            }
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flag size={14} className="text-orange-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-orange-500">{REASON_LABEL[r.reason] ?? r.reason}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{typeLabel[r.content_type] ?? r.content_type}</span>
                  <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{r.content_title || '（内容已删除）'}</span>
                    {viewPath[r.content_type] && (
                      <button onClick={() => navigate(viewPath[r.content_type])}
                        className="text-xs text-primary-600 underline flex-shrink-0">
                        查看
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 flex-1">举报人：{r.reporter?.name ?? '匿名'}</span>
                  <button
                    onClick={() => dismissContentReport(r.id)}
                    disabled={!!acting}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {acting === r.id ? '处理中…' : '忽略'}
                  </button>
                  <button
                    onClick={() => removeReportedContent(r)}
                    disabled={!!acting}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> {actionLabel[r.content_type] ?? '删除'}
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
