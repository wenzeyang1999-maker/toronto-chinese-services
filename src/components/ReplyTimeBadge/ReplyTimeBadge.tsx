// ─── Reply Time Badge ──────────────────────────────────────────────────────────
// Displays provider's average reply time.
// Rules:
//   avg_reply_hours set  → "通常在 X 内回复"
//   no data + joined < 30 days → "新入驻商家"
//   no data + older account    → null (render nothing)
import { Clock, Sparkles } from 'lucide-react'

interface Props {
  avgReplyHours: number | null
  joinedAt: string   // ISO date string e.g. "2026-01-15T..."
  className?: string
}

function formatHours(h: number): string {
  if (h < 1)  return '1 小时'
  if (h < 24) return `${Math.round(h)} 小时`
  const days = Math.round(h / 24)
  return `${days} 天`
}

export default function ReplyTimeBadge({ avgReplyHours, joinedAt, className = '' }: Props) {
  const daysSinceJoin = (Date.now() - new Date(joinedAt).getTime()) / 86_400_000

  if (avgReplyHours != null) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-green-700 bg-green-50
                        border border-green-200 px-2.5 py-1 rounded-full font-medium ${className}`}>
        <Clock size={11} />
        通常在 {formatHours(avgReplyHours)} 内回复
      </span>
    )
  }

  if (daysSinceJoin < 30) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50
                        border border-blue-200 px-2.5 py-1 rounded-full font-medium ${className}`}>
        <Sparkles size={11} />
        新入驻商家
      </span>
    )
  }

  return null
}
