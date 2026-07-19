// ─── Badge ────────────────────────────────────────────────────────────────────
// One place for state chips, so success/danger/warning/info use the semantic
// color tokens (tailwind.config) instead of ad-hoc green/emerald/red/amber —
// closes the "tokens defined but 0 adoption" + green↔emerald drift debt.
import type { ReactNode } from 'react'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'neutral'

const TONE: Record<Tone, string> = {
  success: 'bg-success-50 text-success-700 border-success-200',
  danger:  'bg-danger-50 text-danger-700 border-danger-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  info:    'bg-info-50 text-info-700 border-info-200',
  primary: 'bg-primary-50 text-primary-700 border-primary-200',
  neutral: 'bg-gray-100 text-gray-500 border-gray-200',
}

interface Props {
  tone?: Tone
  children: ReactNode
  className?: string
}

export default function Badge({ tone = 'neutral', children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
