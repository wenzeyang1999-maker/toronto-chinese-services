// ─── 语言切换(简体 / 繁体)─────────────────────────────────────────────────────
// 英/法后续再上,先两档 + 灰显「即将支持」。切换即刷新应用。
import { useState } from 'react'
import { Languages, Check } from 'lucide-react'
import { useLangStore, type Lang } from '../../store/langStore'

const OPTIONS: { key: Lang; label: string }[] = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'zh-TW', label: '繁體中文' },
]

export default function LangSwitcher() {
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex-shrink-0">
      <button onClick={() => setOpen((v) => !v)} aria-label="语言"
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary-600 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors">
        <Languages size={16} />
        <span className="hidden sm:inline">{lang === 'zh-TW' ? '繁' : '简'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-[71] w-36 bg-white rounded-xl border border-gray-100 shadow-lg py-1">
            {OPTIONS.map((o) => (
              <button key={o.key}
                onClick={() => { setOpen(false); if (o.key !== lang) setLang(o.key) }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {o.label}
                {o.key === lang && <Check size={14} className="text-primary-600" />}
              </button>
            ))}
            <div className="border-t border-gray-50 mt-1 pt-1">
              <div className="px-3 py-1.5 text-xs text-gray-300 flex items-center justify-between">English<span>即将</span></div>
              <div className="px-3 py-1.5 text-xs text-gray-300 flex items-center justify-between">Français<span>即将</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
