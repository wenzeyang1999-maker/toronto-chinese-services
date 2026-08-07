// ─── PostFAB ──────────────────────────────────────────────────────────────────
// Floating action button used on all listing pages.
// Pass `label` to render a prominent labelled pill (clearer for new users);
// omit it for the compact frosted-glass circle.
//
// 仅桌面端显示(hidden md:flex)：手机端发布统一走底部导航「+」→ PublishSheet
// (会按当前板块高亮对应发布项),不再有这个左下浮动按钮,避免两个「+」重复。
import { Plus } from 'lucide-react'

interface Props {
  onClick: () => void
  label?: string
}

export default function PostFAB({ onClick, label }: Props) {
  if (label) {
    return (
      <button
        onClick={onClick}
        className="fixed bottom-24 md:bottom-8 left-5 z-30 hidden md:flex items-center gap-2 h-13 px-5 py-3.5 rounded-full
                   bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold
                   active:scale-95 transition-all duration-200"
        style={{ boxShadow: '0 8px 24px rgba(37,99,235,0.35), 0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <Plus size={20} strokeWidth={2.6} />
        {label}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 md:bottom-8 left-5 z-30 w-14 h-14 rounded-full
                 hidden md:flex items-center justify-center text-blue-500
                 active:scale-90 transition-all duration-200"
      style={{
        background:           'rgba(96,165,250,0.25)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border:               '1px solid rgba(147,197,253,0.4)',
        boxShadow:            '0 8px 24px rgba(59,130,246,0.2), 0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <Plus size={28} strokeWidth={2} />
    </button>
  )
}
