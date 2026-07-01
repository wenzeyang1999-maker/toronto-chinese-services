import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import ServiceCard from '../ServiceCard/ServiceCard'
import type { BrowseEntry } from '../../types/browse'

const PAGE = 8
const CTA_INSERT_AT = 4  // insert CTA card after this many items

interface Props {
  excludeIds?: string[]
}

export default function RecommendedServices({ excludeIds }: Props) {
  const services  = useAppStore((s) => s.services)
  const user      = useAuthStore((s) => s.user)
  const navigate  = useNavigate()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [displayed, setDisplayed] = useState(PAGE)
  const excludeSet = useMemo(() => new Set(excludeIds ?? []), [excludeIds])

  const sorted = useMemo(() => {
    if (services.length === 0) return []

    // Category affinity from browse history (ordered by recency)
    const recentCats: string[] = []
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

    const now = Date.now()

    return [...services]
      .filter((s) => s.available && !excludeSet.has(s.id))
      .map(s => {
        let score = 0

        // Rating (0–100)
        score += s.provider.rating * 20

        // Trust tier bonus
        if (s.provider.businessVerified) score += 30
        else if (s.provider.verified)    score += 20
        else if (s.provider.phoneVerified) score += 10

        // Recency decay: fresher services score higher
        const ageDays = (now - new Date(s.createdAt).getTime()) / 86_400_000
        if (ageDays < 7)  score += 15
        else if (ageDays < 30)  score += 8
        else if (ageDays < 90) score += 3

        // Category affinity (top-3 browsed categories get a boost)
        const catIdx = recentCats.indexOf(s.category)
        if (catIdx === 0) score += 25
        else if (catIdx === 1) score += 15
        else if (catIdx === 2) score += 10

        // Promoted
        if (s.isPromoted) score += 20

        // Membership visibility boost (方案A 曝光优先) — a soft nudge on the same
        // scale as trust/freshness, so paid tiers rank higher *among similar*
        // services without overriding a clearly better-rated competitor.
        if (s.provider.membershipLevel === 'L3') score += 30
        else if (s.provider.membershipLevel === 'L2') score += 15

        return { s, score }
      })
      .sort((a, b) => b.score - a.score)
      .map(x => x.s)
  }, [services, excludeSet])

  const loadMore = useCallback(() => {
    setDisplayed((prev) => Math.min(prev + PAGE, sorted.length))
  }, [sorted.length])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  if (sorted.length === 0) return null

  const visible = sorted.slice(0, displayed)
  const hasMore = displayed < sorted.length

  // Build items array with CTA card spliced in
  type Item = { type: 'service'; id: string } | { type: 'cta' }
  const items: Item[] = []
  visible.forEach((svc, i) => {
    if (i === CTA_INSERT_AT) items.push({ type: 'cta' })
    items.push({ type: 'service', id: svc.id })
  })

  const svcMap = Object.fromEntries(visible.map((s) => [s.id, s]))

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="mb-6"
    >
      <div className="flex items-center gap-1.5 mb-3 px-0.5">
        <Sparkles size={16} className="text-primary-500" />
        <h2 className="text-base font-bold text-gray-900">猜你喜欢</h2>
        <span className="text-xs text-gray-400">根据你的浏览推荐</span>
      </div>
      <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-3">
        {items.map((item, idx) =>
          item.type === 'cta' ? (
            <motion.div
              key="cta"
              className="break-inside-avoid mb-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx, 8) * 0.04 }}
            >
              <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-4 text-white flex flex-col gap-3">
                <p className="font-bold text-sm leading-snug">有技能想接单？</p>
                <p className="text-xs text-blue-100 leading-relaxed">免费发布服务，让附近客户找到你</p>
                <button
                  onClick={() => user ? navigate('/post') : navigate('/login', { state: { from: '/post' } })}
                  className="bg-white text-primary-600 rounded-xl py-1.5 text-xs font-semibold hover:bg-blue-50 transition-colors active:scale-95"
                >
                  立即发布 →
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={item.id ?? idx}
              className="break-inside-avoid mb-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx, 8) * 0.04 }}
            >
              <ServiceCard service={svcMap[item.id]} layout="masonry" />
            </motion.div>
          )
        )}
      </div>

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />

      {!hasMore && sorted.length > PAGE && (
        <p className="text-center text-xs text-gray-400 py-4">已显示全部 {sorted.length} 条</p>
      )}
    </motion.section>
  )
}
