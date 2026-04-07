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
import type { BrowseEntry } from '../../pages/Profile/types'

const MAX = 5

export default function RecommendedServices() {
  const services = useAppStore((s) => s.services)

  const recommended = useMemo(() => {
    if (services.length === 0) return []

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

    const available = services.filter((s) => s.available)

    if (recentCats.length > 0) {
      // 2a. Collect services from browsed categories, sorted by rating
      const inCats = available
        .filter((s) => recentCats.includes(s.category))
        .sort((a, b) => b.provider.rating - a.provider.rating)

      // 2b. Pad with other services if not enough
      if (inCats.length >= MAX) return inCats.slice(0, MAX)

      const rest = available
        .filter((s) => !recentCats.includes(s.category))
        .sort((a, b) => b.provider.rating - a.provider.rating)
      return [...inCats, ...rest].slice(0, MAX)
    }

    // 3. Fallback: top-rated across all categories
    return [...available]
      .sort((a, b) => b.provider.rating - a.provider.rating)
      .slice(0, MAX)
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
        <h3 className="text-sm font-semibold text-gray-700">猜您喜欢</h3>
      </div>
      <div className="flex flex-col gap-2">
        {recommended.map((svc) => (
          <ServiceCard key={svc.id} service={svc} />
        ))}
      </div>
    </motion.section>
  )
}
