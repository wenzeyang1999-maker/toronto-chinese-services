// ─── Membership Badge ─────────────────────────────────────────────────────────
// Renders a small tier badge (L1 / L2 / L3) with distinct visual styles.
// L1 — emerald green  (普通会员)
// L2 — gold           (黄金会员)
// L3 — black-gold     (至尊会员)
//
// On mobile, tapping the badge shows a tooltip explaining what the level means.
import { useState, useRef, useEffect } from 'react'

export type MemberLevel = 'L1' | 'L2' | 'L3'

export const LEVEL_CONFIG = {
  L1: {
    name:    '普通会员',
    icon:    '✦',
    bg:      'bg-gradient-to-br from-emerald-400 to-emerald-600',
    text:    'text-white',
    ring:    'ring-1 ring-emerald-500/60',
    shadow:  '',
    description: '注册即可获得，享受基础服务',
  },
  L2: {
    name:    '黄金会员',
    icon:    '★',
    bg:      'bg-gradient-to-br from-amber-300 to-yellow-500',
    text:    'text-white',
    ring:    'ring-1 ring-yellow-400/70',
    shadow:  'shadow-sm shadow-amber-300/40',
    description: '优先展示，黄金认证标识',
  },
  L3: {
    name:    '至尊会员',
    icon:    '♛',
    bg:      'bg-gradient-to-br from-zinc-900 via-zinc-800 to-black',
    text:    'text-amber-400',
    ring:    'ring-1 ring-amber-400/80',
    shadow:  'shadow-md shadow-amber-900/30',
    description: '顶级展示权益，至尊黑金标识，专属服务',
  },
} as const

interface Props {
  level?: MemberLevel | null
  size?:  'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-0.5 rounded-full',
  md: 'text-xs    px-2   py-0.5 gap-1   rounded-full',
  lg: 'text-sm    px-3   py-1   gap-1.5 rounded-full',
}

export default function MembershipBadge({ level = 'L1', size = 'sm' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Close on outside tap
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [open])

  if (!level) return null
  const cfg = LEVEL_CONFIG[level]

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center font-bold tracking-wide cursor-pointer
                    ${cfg.bg} ${cfg.text} ${cfg.ring} ${cfg.shadow} ${SIZE[size]}`}
      >
        <span>{cfg.icon}</span>
        <span>{level}</span>
      </button>

      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                         bg-gray-900 text-white text-xs rounded-xl px-3 py-2
                         whitespace-nowrap shadow-xl pointer-events-none">
          <span className="font-semibold">{cfg.name}</span>
          <span className="mx-1 text-gray-400">·</span>
          {cfg.description}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2
                           border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}
