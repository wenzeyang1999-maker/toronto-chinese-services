// ─── ViewCount ────────────────────────────────────────────────────────────────
// Displays "👁 xx 次浏览" for a listing, and records the view on mount.
//
// Usage:
//   <ViewCount type="secondhand" id={item.id} />
import { useEffect } from 'react'
import { Eye } from 'lucide-react'
import { useViewsStore } from '../../store/viewsStore'
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

  if (count === undefined) return null

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-gray-400 ${className}`}>
      <Eye size={12} />
      {count} 次浏览
    </span>
  )
}
