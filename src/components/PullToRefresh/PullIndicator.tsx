// ─── PullIndicator ────────────────────────────────────────────────────────────
// The little spinner shown at the top of a list while the user pulls down.
// Driven by usePullToRefresh's { distance, refreshing }.
import { Loader2, ArrowDown } from 'lucide-react'

interface Props {
  distance: number
  refreshing: boolean
  threshold: number
}

export default function PullIndicator({ distance, refreshing, threshold }: Props) {
  if (distance <= 0 && !refreshing) return null

  const ready = distance >= threshold
  const progress = Math.min(1, distance / threshold)

  return (
    <div
      className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-10"
      style={{
        transform: `translateY(${Math.max(0, distance - 28)}px)`,
        opacity: refreshing ? 1 : progress,
        transition: distance === 0 ? 'transform 0.2s, opacity 0.2s' : 'none',
      }}
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-md text-primary-600">
        {refreshing ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          <ArrowDown
            size={17}
            className="transition-transform"
            style={{ transform: ready ? 'rotate(180deg)' : `rotate(0deg) scale(${0.7 + progress * 0.3})` }}
          />
        )}
      </span>
    </div>
  )
}
