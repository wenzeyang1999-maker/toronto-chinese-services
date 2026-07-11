import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import ServiceCard from '../ServiceCard/ServiceCard'
import { useRankedServices } from './useRankedServices'

const PAGE = 8
const CTA_INSERT_AT = 4  // insert CTA card after this many items

interface Props {
  excludeIds?: string[]
}

export default function RecommendedServices({ excludeIds }: Props) {
  const user      = useAuthStore((s) => s.user)
  const navigate  = useNavigate()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [displayed, setDisplayed] = useState(PAGE)

  const sorted = useRankedServices(excludeIds)

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
