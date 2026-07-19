// ─── ContactUsButton ──────────────────────────────────────────────────────────
// Profile footer card (styled like InstallAppButton). Opens a sheet with three
// intents, each an in-app form written to the shared `feedback` table (same table
// the AI 客服 report/complaint flow uses):
//   • 提交建议 → type 'suggestion' (free text)
//   • 举报投诉 → type 'report'     (structured: 对象类型/对象/原因/说明)
//   • 寻求合作 → type 'partner'    (free text) + optional direct email
import { useState } from 'react'
import {
  Headphones, ChevronRight, ChevronLeft, Lightbulb, ShieldAlert, Handshake, X, CheckCircle2, Mail,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { COMPLAINT_REASON_TAGS } from '../../constants/reportReasons'

const SUPPORT_EMAIL = 'support@huarenq.com'

type View = 'menu' | 'suggest' | 'report' | 'partner' | 'done'

const MENU: { key: Exclude<View, 'menu' | 'done'>; label: string; desc: string; icon: LucideIcon; tint: string; iconColor: string }[] = [
  { key: 'suggest', label: '提交建议', desc: '功能想法 · 使用体验', icon: Lightbulb,   tint: 'bg-amber-50',   iconColor: 'text-amber-500' },
  { key: 'report',  label: '举报投诉', desc: '违规内容 · 纠纷处理', icon: ShieldAlert,  tint: 'bg-rose-50',    iconColor: 'text-rose-500' },
  { key: 'partner', label: '寻求合作', desc: '商务 · 推广 · 渠道',  icon: Handshake,    tint: 'bg-emerald-50', iconColor: 'text-emerald-600' },
]

export default function ContactUsButton() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [submitting, setSubmitting] = useState(false)

  // Shared form fields
  const [suggestText,    setSuggestText]    = useState('')
  const [reportType,     setReportType]     = useState<'user' | 'service' | 'post'>('user')
  const [reportTarget,   setReportTarget]   = useState('')
  const [reportReason,   setReportReason]   = useState('')
  const [reportDetail,   setReportDetail]   = useState('')
  const [partnerText,    setPartnerText]    = useState('')

  function close() {
    setOpen(false)
    // Reset after the sheet animates away
    setTimeout(() => {
      setView('menu')
      setSuggestText(''); setReportTarget(''); setReportReason(''); setReportDetail('')
      setReportType('user'); setPartnerText('')
    }, 0)
  }

  async function submit(payload: Record<string, unknown>) {
    setSubmitting(true)
    const { error } = await supabase.from('feedback').insert({ user_id: user?.id ?? null, ...payload })
    setSubmitting(false)
    if (error) { alert('提交失败，请稍后重试或直接邮件联系我们'); return }
    setView('done')
  }

  const partnerEmail = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('【寻求合作】')}`
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-gradient-to-br from-primary-50 to-white rounded-2xl border border-primary-100
                   shadow-sm p-4 flex items-center gap-3 hover:from-primary-100 transition-all
                   active:scale-[0.99]"
      >
        <div className="w-11 h-11 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0
                        shadow-sm shadow-primary-200">
          <Headphones size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold text-gray-900">联系我们</p>
          <p className="text-xs text-gray-500 mt-0.5">提交建议 · 举报投诉 · 寻求合作</p>
        </div>
        <ChevronRight size={16} className="text-primary-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-end lg:items-center justify-center"
          onClick={close}
        >
          <div
            className="bg-white rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              {view !== 'menu' && view !== 'done' && (
                <button onClick={() => setView('menu')} className="text-gray-400 hover:text-gray-600 -ml-1" aria-label="返回">
                  <ChevronLeft size={20} />
                </button>
              )}
              <h3 className="text-base font-bold text-gray-900 flex-1">
                {view === 'menu' ? '联系我们'
                  : view === 'suggest' ? '提交建议'
                  : view === 'report' ? '举报投诉'
                  : view === 'partner' ? '寻求合作'
                  : '已提交'}
              </h3>
              <button onClick={close} className="text-gray-400 hover:text-gray-600" aria-label="关闭"><X size={18} /></button>
            </div>

            {/* ── Menu ── */}
            {view === 'menu' && (
              <div className="space-y-2.5">
                <p className="text-xs text-gray-400 -mt-2 mb-1">选择一项，直接在应用内提交</p>
                {MENU.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setView(o.key)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-200
                               bg-white hover:bg-gray-50 active:scale-[0.99] transition-all text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl ${o.tint} flex items-center justify-center flex-shrink-0`}>
                      <o.icon size={19} className={o.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{o.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{o.desc}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* ── 提交建议 ── */}
            {view === 'suggest' && (
              <div className="space-y-3">
                <textarea
                  value={suggestText}
                  onChange={(e) => setSuggestText(e.target.value)}
                  rows={4}
                  maxLength={800}
                  autoFocus
                  placeholder="说说你的想法、遇到的问题或希望增加的功能…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none
                             focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <button
                  onClick={() => submit({ type: 'suggestion', detail: suggestText.trim() })}
                  disabled={submitting || !suggestText.trim()}
                  className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50
                             text-white font-bold rounded-xl text-sm transition-colors"
                >
                  {submitting ? '提交中…' : '提交建议'}
                </button>
              </div>
            )}

            {/* ── 举报投诉 ── */}
            {view === 'report' && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">举报对象类型</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([['user', '用户'], ['service', '服务'], ['post', '帖子']] as const).map(([k, label]) => (
                      <button key={k} onClick={() => setReportType(k)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                          reportType === k ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">
                    {reportType === 'user' ? '用户名 / 昵称' : reportType === 'service' ? '服务标题' : '帖子标题'}
                  </p>
                  <input
                    value={reportTarget}
                    onChange={(e) => setReportTarget(e.target.value)}
                    maxLength={80}
                    placeholder={reportType === 'user' ? '输入被举报的用户名' : '输入被举报内容的标题'}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">举报原因</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COMPLAINT_REASON_TAGS.map((tag) => (
                      <button key={tag} onClick={() => setReportReason(tag === reportReason ? '' : tag)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          reportReason === tag ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-600 border-gray-200'
                        }`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="补充说明（可选）"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none
                             focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <button
                  onClick={() => submit({
                    type: 'report', report_type: reportType,
                    target: reportTarget.trim() || null, reason_tag: reportReason || null,
                    detail: reportDetail.trim() || null,
                  })}
                  disabled={submitting || (!reportTarget.trim() && !reportReason)}
                  className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50
                             text-white font-bold rounded-xl text-sm transition-colors"
                >
                  {submitting ? '提交中…' : '提交举报'}
                </button>
              </div>
            )}

            {/* ── 寻求合作 ── */}
            {view === 'partner' && (
              <div className="space-y-3">
                <textarea
                  value={partnerText}
                  onChange={(e) => setPartnerText(e.target.value)}
                  rows={4}
                  maxLength={800}
                  autoFocus
                  placeholder="简单介绍你的合作意向：公司/项目、合作方式、联系方式…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none
                             focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <button
                  onClick={() => submit({ type: 'partner', detail: partnerText.trim() })}
                  disabled={submitting || !partnerText.trim()}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50
                             text-white font-bold rounded-xl text-sm transition-colors"
                >
                  {submitting ? '提交中…' : '提交合作意向'}
                </button>
                <button
                  onClick={partnerEmail}
                  className="w-full py-2.5 flex items-center justify-center gap-1.5 text-primary-600
                             border border-primary-200 rounded-xl text-sm font-semibold hover:bg-primary-50 transition-colors"
                >
                  <Mail size={15} /> 或直接邮件联系
                </button>
              </div>
            )}

            {/* ── Done ── */}
            {view === 'done' && (
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <CheckCircle2 size={48} className="text-green-500" />
                <p className="text-base font-bold text-gray-800">已收到，谢谢你！</p>
                <p className="text-sm text-gray-500">我们会尽快处理你的反馈</p>
                <button onClick={close} className="mt-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold">
                  完成
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
