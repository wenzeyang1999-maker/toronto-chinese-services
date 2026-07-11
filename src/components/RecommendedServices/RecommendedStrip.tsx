import { Sparkles } from 'lucide-react'
import ServiceCard from '../ServiceCard/ServiceCard'
import { useRankedServices } from './useRankedServices'

interface Props {
  excludeIds?: string[]
  limit?: number
}

// Compact horizontal「猜你喜欢」teaser for the top of the home feed. Shows the
// top-N ranked services in a swipeable row; the full masonry feed stays at the
// bottom (and excludes these ids so they don't repeat). Hidden when empty.
export default function RecommendedStrip({ excludeIds, limit = 8 }: Props) {
  const ranked = useRankedServices(excludeIds)
  if (ranked.length === 0) return null
  const items = ranked.slice(0, limit)

  return (
    <section className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        <Sparkles size={16} className="text-primary-500" />
        <h2 className="text-base font-bold text-gray-900">猜你喜欢</h2>
        <span className="text-xs text-gray-400">根据你的浏览推荐</span>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1 snap-x">
        {items.map((s) => (
          <div key={s.id} className="w-40 flex-shrink-0 snap-start">
            <ServiceCard service={s} layout="masonry" />
          </div>
        ))}
      </div>
    </section>
  )
}
