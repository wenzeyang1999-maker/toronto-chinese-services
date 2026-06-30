// ─── Stats Section (服务商数据面板) ────────────────────────────────────────────
// Shows provider their own listing performance: views, saves, messages, reviews.
// Aggregates across all active services belonging to the user.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, Heart, MessageSquare, Star, TrendingUp, Briefcase, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { getCategoryById } from '../../../data/categories'
import type { ServiceCategory } from '../../../types'

interface StatCard {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  bg: string
  sub?: string
}

interface ServiceStat {
  id: string
  title: string
  category_id: string
  views: number
  saves: number
  reviews: number
  avg_rating: number
}

interface CategoryComparison {
  category_id: string
  label: string
  myServices: number
  myAvgViews: number
  catAvgViews: number
  myAvgRating: number | null
  catAvgRating: number | null
}

export default function StatsSection() {
  const user = useAuthStore((s) => s.user)

  const [totalViews,    setTotalViews]    = useState(0)
  const [totalSaves,    setTotalSaves]    = useState(0)
  const [totalMessages, setTotalMessages] = useState(0)
  const [totalReviews,  setTotalReviews]  = useState(0)
  const [avgRating,     setAvgRating]     = useState(0)
  const [serviceStats,  setServiceStats]  = useState<ServiceStat[]>([])
  const [comparisons,   setComparisons]   = useState<CategoryComparison[]>([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!user) return
    load()
  }, [user?.id])

  async function load() {
    if (!user) return
    setLoading(true)

    // Fetch user's active services
    const { data: services } = await supabase
      .from('services')
      .select('id, title, category_id')
      .eq('provider_id', user.id)
      .eq('is_available', true)

    if (!services || services.length === 0) { setLoading(false); return }

    const serviceIds = services.map(s => s.id)

    // Parallel: views, saves, messages, reviews
    const [viewsRes, savesRes, msgsRes, reviewsRes] = await Promise.all([
      supabase.from('views').select('target_id', { count: 'exact' })
        .eq('target_type', 'service').in('target_id', serviceIds),
      supabase.from('saves').select('target_id', { count: 'exact' })
        .eq('target_type', 'service').in('target_id', serviceIds),
      supabase.from('conversations').select('id', { count: 'exact' })
        .eq('provider_id', user.id),
      supabase.from('reviews').select('service_id, rating')
        .in('service_id', serviceIds),
    ])

    const allReviews = reviewsRes.data ?? []
    const avgR = allReviews.length
      ? allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length
      : 0

    setTotalViews(viewsRes.count ?? 0)
    setTotalSaves(savesRes.count ?? 0)
    setTotalMessages(msgsRes.count ?? 0)
    setTotalReviews(allReviews.length)
    setAvgRating(avgR)

    // Per-service breakdown — views + saves + reviews per service
    const [perViews, perSaves] = await Promise.all([
      supabase.from('views').select('target_id')
        .eq('target_type', 'service').in('target_id', serviceIds),
      supabase.from('saves').select('target_id')
        .eq('target_type', 'service').in('target_id', serviceIds),
    ])

    const viewCount: Record<string, number> = {}
    const saveCount: Record<string, number> = {}
    const reviewCount: Record<string, number> = {}
    const ratingSum: Record<string, number> = {}

    ;(perViews.data ?? []).forEach((r: any) => { viewCount[r.target_id] = (viewCount[r.target_id] ?? 0) + 1 })
    ;(perSaves.data ?? []).forEach((r: any) => { saveCount[r.target_id] = (saveCount[r.target_id] ?? 0) + 1 })
    allReviews.forEach((r: any) => {
      reviewCount[r.service_id] = (reviewCount[r.service_id] ?? 0) + 1
      ratingSum[r.service_id]   = (ratingSum[r.service_id] ?? 0) + r.rating
    })

    const stats: ServiceStat[] = services.map(s => ({
      id:          s.id,
      title:       s.title,
      category_id: s.category_id,
      views:       viewCount[s.id] ?? 0,
      saves:       saveCount[s.id] ?? 0,
      reviews:     reviewCount[s.id] ?? 0,
      avg_rating:  reviewCount[s.id]
        ? Math.round((ratingSum[s.id] / reviewCount[s.id]) * 10) / 10
        : 0,
    }))
    stats.sort((a, b) => b.views - a.views)
    setServiceStats(stats)

    // ── 对比同类:per-category platform benchmarks vs this provider's averages ──
    const { data: benchmarks } = await supabase.rpc('category_service_benchmarks')
    const benchMap: Record<string, { avg_views: number; avg_rating: number | null }> = {}
    ;(benchmarks ?? []).forEach((b: any) => {
      benchMap[b.category_id] = {
        avg_views:  Number(b.avg_views ?? 0),
        avg_rating: b.avg_rating != null ? Number(b.avg_rating) : null,
      }
    })

    const byCat: Record<string, ServiceStat[]> = {}
    stats.forEach((s) => { (byCat[s.category_id] ??= []).push(s) })

    const cmps: CategoryComparison[] = Object.entries(byCat).map(([catId, list]) => {
      const myAvgViews = list.reduce((sum, s) => sum + s.views, 0) / list.length
      const rated      = list.filter((s) => s.reviews > 0)
      const myAvgRating = rated.length
        ? rated.reduce((sum, s) => sum + s.avg_rating, 0) / rated.length
        : null
      const bench = benchMap[catId]
      return {
        category_id:  catId,
        label:        getCategoryById(catId as ServiceCategory)?.label ?? catId,
        myServices:   list.length,
        myAvgViews,
        catAvgViews:  bench?.avg_views ?? 0,
        myAvgRating,
        catAvgRating: bench?.avg_rating ?? null,
      }
    })
    setComparisons(cmps)
    setLoading(false)
  }

  if (loading) return (
    <div className="flex-1 p-4 grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
          <div className="h-7 bg-gray-100 rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
      ))}
    </div>
  )

  const cards: StatCard[] = [
    { label: '总浏览量',   value: totalViews,    icon: <Eye size={18} />,          color: 'text-blue-600',   bg: 'bg-blue-50',   sub: '所有服务累计' },
    { label: '总收藏数',   value: totalSaves,    icon: <Heart size={18} />,         color: 'text-rose-600',   bg: 'bg-rose-50',   sub: '用户已收藏' },
    { label: '收到消息',   value: totalMessages, icon: <MessageSquare size={18} />, color: 'text-green-600',  bg: 'bg-green-50',  sub: '咨询对话数' },
    { label: '收到评价',   value: totalReviews,  icon: <Star size={18} />,          color: 'text-yellow-600', bg: 'bg-yellow-50', sub: avgRating > 0 ? `平均 ${avgRating.toFixed(1)} 星` : '暂无评价' },
  ]

  return (
    <div className="flex-1 px-4 py-5 max-w-md lg:max-w-none mx-auto w-full space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={16} className="text-primary-500" />
        <span className="text-sm font-semibold text-gray-700">我的数据面板</span>
      </div>

      {serviceStats.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <Briefcase size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">暂无活跃服务</p>
          <p className="text-xs text-gray-300 mt-1">发布服务后可在此查看数据</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c, i) => (
              <motion.div key={c.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-2 ${c.color}`}>
                  {c.icon}
                </div>
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                <p className="text-xs font-medium text-gray-600 mt-0.5">{c.label}</p>
                {c.sub && <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>}
              </motion.div>
            ))}
          </div>

          {/* 对比同类 — how this provider stacks up against the category average */}
          {comparisons.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-4 pb-2 flex items-center gap-1.5">
                <TrendingUp size={13} className="text-primary-500" />
                <p className="text-xs font-semibold text-gray-500">对比同类服务</p>
              </div>
              <div className="divide-y divide-gray-50">
                {comparisons.map((c) => {
                  const diff = c.catAvgViews > 0 ? (c.myAvgViews - c.catAvgViews) / c.catAvgViews : 0
                  const pct  = Math.round(Math.abs(diff) * 100)
                  const up   = diff > 0.05
                  const down = diff < -0.05
                  return (
                    <div key={c.category_id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.label}</p>
                        <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          up ? 'bg-green-50 text-green-600' : down ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {up ? <ArrowUp size={11} /> : down ? <ArrowDown size={11} /> : <Minus size={11} />}
                          {up ? `高于同类 ${pct}%` : down ? `低于同类 ${pct}%` : '与同类持平'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye size={11} className="text-blue-400" />
                          你 {c.myAvgViews.toFixed(1)} · 同类 {c.catAvgViews.toFixed(1)} 浏览/服务
                        </span>
                        {c.myAvgRating != null && c.catAvgRating != null && (
                          <span className="flex items-center gap-1">
                            <Star size={11} className="text-yellow-400" />
                            你 {c.myAvgRating.toFixed(1)} · 同类 {c.catAvgRating.toFixed(1)} 星
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="px-5 py-2 text-[10px] text-gray-300 border-t border-gray-50">
                同类平均为该分类全平台在架服务的均值,仅供参考
              </p>
            </div>
          )}

          {/* Per-service breakdown */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs font-semibold text-gray-500">各服务表现</p>
            </div>
            <div className="divide-y divide-gray-50">
              {serviceStats.map((s, i) => (
                <motion.div key={s.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="px-5 py-3.5"
                >
                  <p className="text-sm font-semibold text-gray-800 truncate mb-1.5">{s.title}</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Eye size={11} className="text-blue-400" /> {s.views} 浏览
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Heart size={11} className="text-rose-400" /> {s.saves} 收藏
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Star size={11} className="text-yellow-400" />
                      {s.reviews > 0 ? `${s.reviews} 评价 · ${s.avg_rating}星` : '暂无评价'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
