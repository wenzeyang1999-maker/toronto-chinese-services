// ─── ContactUsButton ──────────────────────────────────────────────────────────
// Profile footer card (styled like InstallAppButton). Tapping opens a sheet with
// three contact intents; each opens the mail app pre-filled to support with the
// matching subject so messages land in the right bucket.
import { useState } from 'react'
import { Headphones, ChevronRight, Lightbulb, ShieldAlert, Handshake, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const SUPPORT_EMAIL = 'support@huarenq.com'

const OPTIONS: { key: string; label: string; desc: string; subject: string; icon: LucideIcon; tint: string; iconColor: string }[] = [
  { key: 'suggest', label: '提交建议', desc: '功能想法 · 使用体验', subject: '【提交建议】', icon: Lightbulb,   tint: 'bg-amber-50',   iconColor: 'text-amber-500' },
  { key: 'report',  label: '举报投诉', desc: '违规内容 · 纠纷处理', subject: '【举报投诉】', icon: ShieldAlert,  tint: 'bg-rose-50',    iconColor: 'text-rose-500' },
  { key: 'partner', label: '寻求合作', desc: '商务 · 推广 · 渠道',  subject: '【寻求合作】', icon: Handshake,    tint: 'bg-emerald-50', iconColor: 'text-emerald-600' },
]

export default function ContactUsButton() {
  const [open, setOpen] = useState(false)

  function pick(subject: string) {
    setOpen(false)
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
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
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl lg:rounded-3xl w-full lg:max-w-sm p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-gray-900">联系我们</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">选择一项，我们会通过邮件与你联系</p>

            <div className="space-y-2.5">
              {OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => pick(o.subject)}
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
          </div>
        </div>
      )}
    </>
  )
}
