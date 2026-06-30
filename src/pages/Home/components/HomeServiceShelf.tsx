import { ChevronRight, List, Map, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { Component, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Service } from '../../../types'
import ServiceCard from '../../../components/ServiceCard/ServiceCard'
import { fuzzyFilterServices } from '../../../lib/fuzzySearch'
import { ServiceListSkeleton } from '../../../components/Skeleton/Skeleton'
import { useAppStore } from '../../../store/appStore'

class MapErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() { return { err: true } }
  componentDidCatch() { this.props.onError() }
  render() {
    if (this.state.err) return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 py-10 text-gray-400 text-sm gap-2">
        <Map size={28} className="opacity-40" />
        <span>地图暂不可用，已切换至列表</span>
      </div>
    )
    return this.props.children
  }
}

interface Props {
  title: string
  subtitle: string
  viewMode: 'list' | 'map'
  onViewModeChange: (next: 'list' | 'map') => void
  services: Service[]              // list view (nearby/recent subset)
  allServices: Service[]           // full pool for keyword search
  defaultMapServices: Service[]    // nearby-only default for map (no search)
  mapContent: (filtered: Service[], keyword: string) => React.ReactNode
}

export default function HomeServiceShelf({
  title,
  subtitle,
  viewMode,
  onViewModeChange,
  services,
  allServices,
  defaultMapServices,
  mapContent,
}: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const servicesLoaded = useAppStore((s) => s.servicesLoaded)

  const q = query.trim()

  const filteredList = q ? fuzzyFilterServices(services, q)    : services
  const filteredMap  = q ? fuzzyFilterServices(allServices, q) : defaultMapServices

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    // In map mode just filter markers; in list mode navigate to full search
    if (query.trim() && viewMode === 'list') navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="mb-6"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-gray-100 p-0.5">
            <button
              onClick={() => onViewModeChange('list')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={13} /> 列表
            </button>
            <button
              onClick={() => onViewModeChange('map')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === 'map' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Map size={13} /> 地图
            </button>
          </div>

          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-0.5 text-xs text-primary-600"
          >
            全部 <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-3 flex items-center gap-2.5 rounded-2xl border border-primary-200 bg-white px-4 py-2.5 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
        <Search size={16} className="shrink-0 text-primary-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索商家或服务名称…"
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
        />
        {query.trim() && (
          <button type="submit" className="shrink-0 rounded-lg bg-primary-600 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-700 transition-colors">
            搜索
          </button>
        )}
      </form>

      {viewMode === 'list' ? (
        <div className="flex flex-col gap-2">
          {filteredList.length > 0
            ? filteredList.map((svc) => <ServiceCard key={svc.id} service={svc} />)
            : q
              ? <p className="py-6 text-center text-sm text-gray-400">没有找到相关服务</p>
              : servicesLoaded
                ? <p className="py-6 text-center text-sm text-gray-400">附近暂无服务，换个区域看看～</p>
                : <ServiceListSkeleton count={4} />
          }
        </div>
      ) : (
        <MapErrorBoundary onError={() => onViewModeChange('list')}>
          <Suspense
            fallback={<div className="w-full rounded-2xl bg-gray-100 animate-pulse" style={{ height: '60vh', minHeight: 320 }} />}
          >
            {mapContent(filteredMap, q.toLowerCase())}
          </Suspense>
        </MapErrorBoundary>
      )}
    </motion.section>
  )
}
