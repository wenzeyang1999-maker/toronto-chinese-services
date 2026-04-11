// ─── RecommendedServices ──────────────────────────────────────────────────────
// "猜您喜欢" section on Home page.
// Logic:
//   1. Read tcs_browse_history from localStorage → extract recently-browsed categories
//   2. From the store, pick services in those categories (most-rated first)
//   3. Fallback: if no history, show top-rated services across all categories
// Renders nothing if there are no services at all.
import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import ServiceCard from '../ServiceCard/ServiceCard'
import type { BrowseEntry } from '../../types/browse'

const MAX = 5

export default function RecommendedServices() {
  const services = useAppStore((s) => s.services)

  const { recommended, reason } = useMemo(() => {
    if (services.length === 0) return { recommended: [], reason: '' }

    // 1. Get recently-browsed category IDs (most recent first, deduplicated)
    let recentCats: string[] = []
    try {
      const entries: BrowseEntry[] = JSON.parse(localStorage.getItem('tcs_browse_history') ?? '[]')
      const seen = new Set<string>()
      for (const e of entries) {
        if (e.category && !seen.has(e.category)) {
          seen.add(e.category)
          recentCats.push(e.category)
        }
      }
    } catch { /* ignore */ }

    // Sort once by rating; partition into browsed-category vs. rest
    const byRating = [...services]
      .filter((s) => s.available)
      .sort((a, b) => b.provider.rating - a.provider.rating)

    if (recentCats.length > 0) {
      const inCats = byRating.filter((s) =>  recentCats.includes(s.category))
      const rest   = byRating.filter((s) => !recentCats.includes(s.category))
      return {
        recommended: [...inCats, ...rest].slice(0, MAX),
        reason: '根据你最近浏览过的服务类型推荐',
      }
    }

    return {
      recommended: byRating.slice(0, MAX),
      reason: '先看看本地口碑较好的服务',
    }
  }, [services])

  if (recommended.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="mb-6"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles size={14} className="text-primary-500" />
        <div>
          <h3 className="text-sm font-semibold text-gray-700">猜你喜欢</h3>
          <p className="mt-0.5 text-xs text-gray-400">{reason}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {recommended.map((svc) => (
          <ServiceCard key={svc.id} service={svc} />
        ))}
      </div>
    </motion.section>
  )
}
