// ─── ViewCount ────────────────────────────────────────────────────────────────
// Displays "👁 xx 次浏览" for a listing, and records the view on mount.
//
// Usage:
//   <ViewCount type="secondhand" id={item.id} />
import { useEffect } from 'react'
import { Eye } from 'lucide-react'
import { useViewsStore } from '../../store/interactionStore'
import { useAuthStore } from '../../store/authStore'

type TargetType = 'service' | 'job' | 'property' | 'secondhand' | 'event'

interface Props {
  type:       TargetType
  id:         string
  className?: string
}

export default function ViewCount({ type, id, className = '' }: Props) {
  const user        = useAuthStore((s) => s.user)
  const recordView  = useViewsStore((s) => s.recordView)
  const fetchCount  = useViewsStore((s) => s.fetchCount)
  const count       = useViewsStore((s) => s.counts[`${type}:${id}`])

  useEffect(() => {
    fetchCount(type, id)
    recordView(type, id, user?.id)
  }, [type, id])

  // Reserve space with a small skeleton while the count loads, so the row
  // doesn't shift when the number pops in.
  if (count === undefined) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-gray-300 ${className}`} aria-hidden>
        <Eye size={12} />
        <span className="inline-block w-8 h-3 bg-gray-100 rounded animate-pulse" />
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-gray-400 ${className}`}>
      <Eye size={12} />
      {count} 次浏览
    </span>
  )
}
