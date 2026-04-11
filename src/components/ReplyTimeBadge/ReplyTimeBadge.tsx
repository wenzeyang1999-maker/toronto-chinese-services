// ─── Reply Time Badge ──────────────────────────────────────────────────────────
// Displays provider's average reply time + active status.
// Rules:
//   last_seen_at within 24h  → "活跃商家" badge (always shown when true)
//   avg_reply_hours set       → "通常在 X 内回复"
//   no data + joined < 30d   → "新入驻商家"
//   no data + older account  → null
import { Clock, Sparkles, Zap } from 'lucide-react'

interface Props {
  avgReplyHours: number | null
  joinedAt:      string          // ISO date string
  lastSeenAt?:   string | null   // ISO date string, optional
  className?:    string
}

function formatHours(h: number): string {
  if (h < 1)  return '1 小时'
  if (h < 24) return `${Math.round(h)} 小时`
  return `${Math.round(h / 24)} 天`
}

export default function ReplyTimeBadge({ avgReplyHours, joinedAt, lastSeenAt, className = '' }: Props) {
  const daysSinceJoin  = (Date.now() - new Date(joinedAt).getTime()) / 86_400_000
  const isActive       = lastSeenAt
    ? Date.now() - new Date(lastSeenAt).getTime() < 24 * 60 * 60 * 1000
    : false

  const activeBadge = isActive ? (
    <span className={`inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50
                      border border-emerald-200 px-2.5 py-1 rounded-full font-medium ${className}`}>
      <Zap size={11} className="fill-emerald-500" />
      活跃商家
    </span>
  ) : null

  if (avgReplyHours != null) {
    return (
      <>
        {activeBadge}
        <span className={`inline-flex items-center gap-1 text-xs text-green-700 bg-green-50
                          border border-green-200 px-2.5 py-1 rounded-full font-medium ${className}`}>
          <Clock size={11} />
          通常在 {formatHours(avgReplyHours)} 内回复
        </span>
      </>
    )
  }

  if (daysSinceJoin < 30) {
    return (
      <>
        {activeBadge}
        <span className={`inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50
                          border border-blue-200 px-2.5 py-1 rounded-full font-medium ${className}`}>
          <Sparkles size={11} />
          新入驻商家
        </span>
      </>
    )
  }

  return activeBadge
}
