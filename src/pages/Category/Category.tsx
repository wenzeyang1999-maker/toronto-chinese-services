import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, SlidersHorizontal, List, Map, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState, lazy, Suspense } from 'react'
import ServiceCard from '../../components/ServiceCard/ServiceCard'
import InquiryModal from '../../components/InquiryModal/InquiryModal'
import { useAppStore } from '../../store/appStore'
import { getCategoryById } from '../../data/categories'
import type { ServiceCategory } from '../../types'
import Header from '../../components/Header/Header'
import ErrorState from '../../components/ErrorState/ErrorState'
import { useGeolocation } from '../../hooks/useGeolocation'
import PageMeta from '../../components/PageMeta/PageMeta'

const ServiceMap = lazy(() => import('../../components/ServiceMap/ServiceMap'))

const PAGE_SIZE = 20

export default function Category() {
  const requestLocation = useGeolocation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const getServicesByCategory = useAppStore((s) => s.getServicesByCategory)
  const userLocation = useAppStore((s) => s.userLocation)
  const servicesError = useAppStore((s) => s.servicesError)
  const fetchServices = useAppStore((s) => s.fetchServices)
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>(
    () => (searchParams.get('sort') as 'distance' | 'rating' | 'price') || 'rating'
  )
  const [viewMode, setViewMode] = useState<'list' | 'map'>(
    () => searchParams.get('view') === 'map' ? 'map' : 'list'
  )
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [page, setPage] = useState(1)

  // Reset pagination on sort change
  useEffect(() => { setPage(1) }, [sortBy])

  const category = getCategoryById(id as ServiceCategory)
  const services = getServicesByCategory(id as ServiceCategory)

  // Without a user location, "距离" can't sort meaningfully (every distance is
  // undefined), so fall back to rating until location arrives, then it re-sorts.
  const effectiveSort = sortBy === 'distance' && !userLocation ? 'rating' : sortBy
  const sorted = [...services].sort((a, b) => {
    if (effectiveSort === 'rating') return b.provider.rating - a.provider.rating
    if (effectiveSort === 'price') return parseFloat(a.price) - parseFloat(b.price)
    return (a.distance ?? 99) - (b.distance ?? 99)
  })

  const handleSortChange = (next: typeof sortBy) => {
    setSortBy(next)
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('sort', next); return n }, { replace: true })
    if (next === 'distance' && !userLocation) requestLocation()
  }

  const handleViewModeChange = (next: typeof viewMode) => {
    setViewMode(next)
    setSearchParams((prev) => { const n = new URLSearchParams(prev); if (next !== 'list') n.set('view', next); else n.delete('view'); return n }, { replace: true })
    if (next === 'map' && !userLocation) requestLocation()
  }

  if (!category) {
    return <div className="p-8 text-center text-gray-500">分类不存在</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageMeta title={`${category.label}服务`} description={category.description} />
      <Header />

      {/* Category hero — compact */}
      <div className={`${category.bgColor} pt-3 pb-4`}>
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-gray-600 mb-2 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">返回</span>
          </button>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img loading="lazy" src={category.image} alt={category.label} className="w-10 h-10 object-contain flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <div className="flex items-baseline gap-2">
                <h1 className={`text-xl font-bold leading-none ${category.color}`}>{category.label}</h1>
                <p className="text-gray-400 text-xs">{category.description}</p>
              </div>
            </div>
            {/* AI 帮你找 */}
            <button
              onClick={() => setInquiryOpen(true)}
              className="flex-shrink-0 flex items-center gap-1.5 bg-white/80 hover:bg-white
                         text-primary-700 font-semibold rounded-xl shadow-sm px-3 py-2
                         text-sm transition-colors border border-white/60"
            >
              <Sparkles size={14} className="text-primary-500" />
              AI 帮你找
            </button>
          </div>
        </div>
      </div>

      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />

      <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto mt-4">
        {/* Sort bar + view toggle */}
        <div className="card p-3 mb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          <SlidersHorizontal size={14} className="text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 mr-1 flex-shrink-0">排序：</span>
          {[
            { value: 'distance', label: '距离优先' },
            { value: 'rating', label: '好评优先' },
            { value: 'price', label: '价格从低到高' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortChange(opt.value as typeof sortBy)}
              className={`flex-shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-colors ${
                sortBy === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {/* View mode toggle */}
          <div className="ml-auto flex-shrink-0 flex items-center bg-gray-100 rounded-xl p-0.5">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`flex-shrink-0 flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={15} /> 列表
            </button>
            <button
              onClick={() => handleViewModeChange('map')}
              className={`flex-shrink-0 flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Map size={15} /> 地图
            </button>
          </div>
        </div>

        {/* Count */}
        <p className="text-xs text-gray-400 mb-3">共找到 {sorted.length} 个服务</p>
        {!userLocation && (sortBy === 'distance' || viewMode === 'map') && (
          <p className="text-xs text-amber-600 mb-3">
            允许位置权限后，可按距离排序并显示您附近的商家位置。
          </p>
        )}

        {/* Map view */}
        {viewMode === 'map' && (
          <div className="mb-6">
            <Suspense fallback={
              <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center"
                   style={{ height: '60vh', minHeight: 320 }}>
                <p className="text-sm text-gray-400">地图加载中…</p>
              </div>
            }>
              <ServiceMap services={sorted} />
            </Suspense>
          </div>
        )}

        {/* List view */}
        {viewMode === 'list' && (servicesError && sorted.length === 0 ? (
          <ErrorState onRetry={() => fetchServices()} />
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <img loading="lazy" src={category.image} alt={category.label} className="w-12 h-12 mx-auto mb-3 object-contain opacity-40"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <p>暂无此类服务</p>
            <button
              onClick={() => navigate('/post')}
              className="mt-4 btn-primary text-sm"
            >
              率先发布此类服务
            </button>
          </div>
        ) : (
          <>
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04 } } }}
              className="flex flex-col gap-2 mb-3"
            >
              {sorted.slice(0, page * PAGE_SIZE).map((svc) => (
                <motion.div
                  key={svc.id}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                >
                  <ServiceCard service={svc} />
                </motion.div>
              ))}
            </motion.div>
            {sorted.length > page * PAGE_SIZE && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="w-full mb-6 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600
                           font-medium hover:bg-gray-50 transition-colors"
              >
                加载更多（还有 {sorted.length - page * PAGE_SIZE} 条）
              </button>
            )}
            {sorted.length <= page * PAGE_SIZE && sorted.length > PAGE_SIZE && (
              <p className="text-center text-xs text-gray-400 py-3 mb-3">已显示全部 {sorted.length} 条结果</p>
            )}
          </>
        ))}
      </div>
    </div>
  )
}
