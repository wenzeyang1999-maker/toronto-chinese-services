// ─── Admin · Inquiries tab ───────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Inbox, Mail, CheckCheck } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type InquiryRow, type InquiryMatch, INQUIRY_STATUS_LABEL } from '../types'
import { useAdminContext } from '../AdminContext'

const PAGE = 30

export default function InquiriesTab() {
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [hasMore,   setHasMore]   = useState(false)

  async function loadInquiries(append = false) {
    const start = append ? inquiries.length : 0
    const { data, error } = await supabase
      .from('inquiries')
      .select('id, category_id, description, budget, timing, name, phone, wechat, status, created_at')
      .order('created_at', { ascending: false })
      .range(start, start + PAGE - 1)
    if (error) {
      showNotice('error', `加载询价失败：${error.message}`)
      return
    }
    if (!data) return

    const ids = data.map((r: any) => r.id)
    const { data: matches, error: matchesError } = await supabase
      .from('inquiry_matches')
      .select('id, inquiry_id, provider_name, provider_email, email_sent')
      .in('inquiry_id', ids)
    if (matchesError) {
      showNotice('error', `加载询价匹配失败：${matchesError.message}`)
      return
    }

    const matchMap: Record<string, InquiryMatch[]> = {}
    for (const m of matches ?? []) {
      if (!matchMap[m.inquiry_id]) matchMap[m.inquiry_id] = []
      matchMap[m.inquiry_id].push(m)
    }
    const newItems = data.map((r: any) => ({ ...r, matches: matchMap[r.id] ?? [] }))
    if (append) setInquiries(prev => [...prev, ...newItems])
    else setInquiries(newItems)
    setHasMore(data.length === PAGE)
  }

  async function updateInquiryStatus(inquiryId: string, status: InquiryRow['status']) {
    setActing(inquiryId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_inquiry_status', {
        inquiry_id: inquiryId,
        new_status: status,
      })
      if (error) throw error
    }, `询价状态已更新为${INQUIRY_STATUS_LABEL[status]}`)
    if (ok !== null) {
      setInquiries(prev => prev.map(inq => (
        inq.id === inquiryId ? { ...inq, status } : inq
      )))
    }
    setActing(null)
  }

  useEffect(() => {
    void loadInquiries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 flex-1">
          共 <strong>{inquiries.length}</strong> 条 · 待处理 <strong className="text-green-600">{inquiries.filter(i => i.status === 'open').length}</strong> · 已匹配 <strong className="text-blue-600">{inquiries.filter(i => i.status === 'matched').length}</strong> · 已关闭 <strong className="text-gray-500">{inquiries.filter(i => i.status === 'closed').length}</strong>
        </span>
        <button onClick={() => loadInquiries()}
          className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
          刷新
        </button>
      </div>
      {inquiries.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <Inbox size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">暂无询价记录</p>
        </div>
      ) : inquiries.map(inq => (
        <div key={inq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                {inq.category_id}
              </span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
                inq.status === 'open' ? 'bg-green-50 text-green-600' :
                inq.status === 'matched' ? 'bg-blue-50 text-blue-600' :
                'bg-gray-100 text-gray-500'
              }`}>{INQUIRY_STATUS_LABEL[inq.status] ?? inq.status}</span>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{inq.created_at.slice(0, 10)}</span>
          </div>

          {/* Customer info */}
          <div className="text-sm text-gray-800">
            <p className="font-medium">{inq.name} · {inq.phone}{inq.wechat ? ` · 微信: ${inq.wechat}` : ''}</p>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">{inq.description}</p>
            {(inq.budget || inq.timing) && (
              <p className="text-xs text-gray-400 mt-1">
                {inq.budget ? `预算: $${inq.budget}` : ''}{inq.budget && inq.timing ? ' · ' : ''}{inq.timing}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {inq.status !== 'open' && (
              <button
                onClick={() => updateInquiryStatus(inq.id, 'open')}
                disabled={acting === inq.id}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-semibold transition-colors disabled:opacity-50"
              >
                设为待处理
              </button>
            )}
            {inq.status !== 'matched' && (
              <button
                onClick={() => updateInquiryStatus(inq.id, 'matched')}
                disabled={acting === inq.id}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors disabled:opacity-50"
              >
                标记已匹配
              </button>
            )}
            {inq.status !== 'closed' && (
              <button
                onClick={() => updateInquiryStatus(inq.id, 'closed')}
                disabled={acting === inq.id}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
              >
                关闭询价
              </button>
            )}
          </div>

          {/* Matched providers */}
          <div className="border-t border-gray-50 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              <Mail size={12} /> 已通知服务商（{inq.matches.length}）
            </p>
            {inq.matches.length === 0 ? (
              <p className="text-xs text-gray-400">无匹配服务商</p>
            ) : (
              <div className="space-y-1.5">
                {inq.matches.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCheck size={12} className="text-green-500 flex-shrink-0" />
                    <span className="font-medium">{m.provider_name}</span>
                    <span className="text-gray-400">{m.provider_email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => loadInquiries(true)}
          className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
        >
          加载更多
        </button>
      )}
    </motion.div>
  )
}
