import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, SlidersHorizontal, List, Map } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, lazy, Suspense } from 'react'
import ServiceCard from '../../components/ServiceCard/ServiceCard'
import { useAppStore } from '../../store/appStore'
import { getCategoryById } from '../../data/categories'
import type { ServiceCategory } from '../../types'
import Header from '../../components/Header/Header'

const ServiceMap = lazy(() => import('../../components/ServiceMap/ServiceMap'))

export default function Category() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const getServicesByCategory = useAppStore((s) => s.getServicesByCategory)
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>('distance')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  const category = getCategoryById(id as ServiceCategory)
  const services = getServicesByCategory(id as ServiceCategory)

  const sorted = [...services].sort((a, b) => {
    if (sortBy === 'rating') return b.provider.rating - a.provider.rating
    if (sortBy === 'price') return parseFloat(a.price) - parseFloat(b.price)
    return (a.distance ?? 99) - (b.distance ?? 99)
  })

  if (!category) {
    return <div className="p-8 text-center text-gray-500">分类不存在</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Category hero */}
      <div className={`${category.bgColor} px-4 pt-4 pb-8`}>
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-gray-600 mb-4 hover:text-gray-900"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">返回</span>
          </button>

          <div className="flex items-center gap-3">
            <img src={category.image} alt={category.label} className="w-14 h-14 object-contain" />
            <div>
              <h1 className={`text-2xl font-bold ${category.color}`}>{category.label}</h1>
              <p className="text-gray-600 text-sm">{category.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-3">
        {/* Sort bar + view toggle */}
        <div className="card p-3 mb-4 flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500 mr-1">排序：</span>
          {[
            { value: 'distance', label: '距离优先' },
            { value: 'rating', label: '好评优先' },
            { value: 'price', label: '价格优先' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value as typeof sortBy)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                sortBy === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {/* View mode toggle */}
          <div className="ml-auto flex items-center bg-gray-100 rounded-full p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              <List size={13} /> 列表
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${
                viewMode === 'map' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Map size={13} /> 地图
            </button>
          </div>
        </div>

        {/* Count */}
        <p className="text-xs text-gray-400 mb-3">共找到 {sorted.length} 个服务</p>

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
        {viewMode === 'list' && (sorted.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <img src={category.image} alt={category.label} className="w-12 h-12 mx-auto mb-3 object-contain opacity-40" />
            <p>暂无此类服务</p>
            <button
              onClick={() => navigate('/post')}
              className="mt-4 btn-primary text-sm"
            >
              率先发布此类服务
            </button>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.04 } } }}
            className="flex flex-col gap-2 mb-6"
          >
            {sorted.map((svc) => (
              <motion.div
                key={svc.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <ServiceCard service={svc} />
              </motion.div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
