// ─── PostFAB ──────────────────────────────────────────────────────────────────
// Frosted-glass floating action button used on all listing pages.
import { Plus } from 'lucide-react'

interface Props {
  onClick: () => void
}

export default function PostFAB({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 left-5 z-30 w-14 h-14 rounded-full
                 flex items-center justify-center text-blue-500
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
