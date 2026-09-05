import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { supabase } from '../../lib/supabase'
import ServiceCard from '../ServiceCard/ServiceCard'
import { useRankedServices } from './useRankedServices'

const PAGE = 8
const CTA_INSERT_AT = 4  // insert CTA card after this many items

// 帖子少时,把服务商(注册+收录)也混进推荐流,让「猜你喜欢」更充实。
type MerchantStatus = 'online' | 'offline' | 'unclaimed'
interface Merchant {
  source: 'user' | 'directory'
  id: string
  name: string
  avatar_url: string | null
  bio: string | null
  category_id: string | null
  area: string | null
  status: MerchantStatus
  verified: boolean
}

// 商家橱窗本地缓存(秒开):下次进来先用缓存渲染,再后台刷新。
const MERCHANTS_CACHE_KEY = 'tcs_merchants_cache_v1'
function readCachedMerchants(): Merchant[] {
  try {
    const raw = localStorage.getItem(MERCHANTS_CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? (parsed as Merchant[]) : []
  } catch { return [] }
}

interface Props {
  excludeIds?: string[]
}

export default function RecommendedServices({ excludeIds }: Props) {
  const user      = useAuthStore((s) => s.user)
  const navigate  = useNavigate()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [displayed, setDisplayed] = useState(PAGE)
  const [merchants, setMerchants] = useState<Merchant[]>(readCachedMerchants)
  const [merchantsLoaded, setMerchantsLoaded] = useState<boolean>(() => readCachedMerchants().length > 0)
  const servicesLoaded = useAppStore((s) => s.servicesLoaded)

  useEffect(() => {
    supabase.rpc('merchant_showcase', { p_limit: 24 })
      .then(
        ({ data }) => {
          if (data) {
            setMerchants(data as Merchant[])
            try { localStorage.setItem(MERCHANTS_CACHE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
          }
          setMerchantsLoaded(true)
        },
        () => setMerchantsLoaded(true),
      )
  }, [])

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

  // 数据还在路上(服务帖或商家未加载完)时,给瀑布流骨架占位,避免"空白→突然冒出"。
  const stillLoading = !servicesLoaded || !merchantsLoaded
  if (sorted.length === 0 && merchants.length === 0) {
    if (!stillLoading) return null
    return (
      <section className="mb-6">
        <div className="flex items-center gap-1.5 mb-3 px-0.5">
          <Sparkles size={16} className="text-primary-500" />
          <h2 className="text-base font-bold text-gray-900">猜你喜欢</h2>
          <span className="text-xs text-gray-400">根据你的浏览推荐</span>
        </div>
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-3">
          {[220, 180, 240, 190, 210, 170, 230, 200].map((h, i) => (
            <div key={i} className="break-inside-avoid mb-3 rounded-2xl bg-gray-100 animate-pulse" style={{ height: h }} />
          ))}
        </div>
      </section>
    )
  }

  const visible = sorted.slice(0, displayed)
  const hasMore = displayed < sorted.length

  // Build items array: 帖子(含 CTA)在前,服务商卡接在后面凑满瀑布流。
  type Item = { type: 'service'; id: string } | { type: 'cta' } | { type: 'merchant'; m: Merchant }
  const items: Item[] = []
  visible.forEach((svc, i) => {
    if (i === CTA_INSERT_AT) items.push({ type: 'cta' })
    items.push({ type: 'service', id: svc.id })
  })
  if (visible.length <= CTA_INSERT_AT && !items.some((x) => x.type === 'cta')) items.push({ type: 'cta' })
  // 帖子全部展示完后,再铺服务商卡(帖子还有分页时先不铺,避免打断"加载更多")。
  if (!hasMore) merchants.forEach((m) => items.push({ type: 'merchant', m }))

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
        {items.map((item, idx) => {
          const anim = {
            className: 'break-inside-avoid mb-3',
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.2, delay: Math.min(idx, 8) * 0.04 },
          }
          if (item.type === 'cta') {
            return (
              <motion.div key="cta" {...anim}>
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
            )
          }
          if (item.type === 'merchant') {
            const m = item.m
            const online = m.status === 'online'
            const unclaimed = m.status === 'unclaimed'
            return (
              <motion.div key={`m-${m.source}-${m.id}`} {...anim}>
                <button
                  onClick={() => navigate(m.source === 'user' ? `/provider/${m.id}` : `/merchant/${m.id}`)}
                  className={`w-full text-left rounded-2xl border p-3 shadow-sm transition-all active:scale-[0.99] ${
                    online ? 'bg-white border-emerald-200 hover:border-emerald-300'
                           : unclaimed ? 'bg-white border-amber-200 hover:border-amber-300'
                                       : 'bg-gray-50 border-gray-100 hover:border-gray-200'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ${
                      online ? 'ring-emerald-200 bg-emerald-50' : unclaimed ? 'ring-amber-200 bg-amber-50' : 'ring-gray-200 bg-gray-100'} ${
                      !online && !unclaimed ? 'grayscale opacity-80' : ''}`}>
                      {m.avatar_url
                        ? <img loading="lazy" src={m.avatar_url} alt={m.name} className="w-10 h-10 object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <span className={`text-base font-bold ${online ? 'text-emerald-600' : unclaimed ? 'text-amber-600' : 'text-gray-400'}`}>{(m.name || '商').charAt(0)}</span>}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      online ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                             : unclaimed ? 'text-amber-600 bg-amber-50 border border-amber-200'
                                         : 'text-gray-400 bg-gray-100 border border-gray-200'}`}>
                      {online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      {online ? '在线接单' : unclaimed ? '待认领' : '暂未上线'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className={`text-sm font-bold truncate ${online || unclaimed ? 'text-gray-900' : 'text-gray-600'}`}>{m.name || '服务商'}</p>
                    {m.verified && <ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-snug">
                    {m.bio || (m.area ? `${m.area} · 华人本地服务` : '华人本地服务商家')}
                  </p>
                </button>
              </motion.div>
            )
          }
          return (
            <motion.div key={item.id ?? idx} {...anim}>
              <ServiceCard service={svcMap[item.id]} layout="masonry" />
            </motion.div>
          )
        })}
      </div>

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />

      {!hasMore && sorted.length > PAGE && (
        <p className="text-center text-xs text-gray-400 py-4">已显示全部 {sorted.length} 条</p>
      )}
    </motion.section>
  )
}
