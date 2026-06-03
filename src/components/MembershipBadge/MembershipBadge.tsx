// ─── Membership Badge ─────────────────────────────────────────────────────────
// Renders a small tier badge (L1 / L2 / L3) with distinct visual styles.
// L1 — emerald green  (普通会员)
// L2 — gold           (黄金会员)
// L3 — black-gold     (至尊会员)
//
// Tapping the badge opens a portal-based card fixed at the bottom of the screen,
// which is visible regardless of any ancestor overflow:hidden or overflow:scroll.
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

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

      {open && createPortal(
        <>
          {/* Backdrop — closes on tap anywhere outside the card */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Detail card fixed at bottom — visible regardless of ancestor overflow */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-72 bg-gray-900 text-white rounded-2xl px-5 py-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center gap-1 font-bold text-sm px-2.5 py-1 rounded-full
                               ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                {cfg.icon} {level}
              </span>
              <span className="font-semibold text-base">{cfg.name}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{cfg.description}</p>
            <p className="text-xs text-gray-500 mt-3 text-center">点击任意处关闭</p>
          </div>
        </>,
        document.body,
      )}
    </span>
  )
}
