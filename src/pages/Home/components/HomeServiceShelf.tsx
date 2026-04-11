import { ChevronRight, List, Map } from 'lucide-react'
import { motion } from 'framer-motion'
import { Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Service } from '../../../types'
import type { ReactNode } from 'react'
import ServiceCard from '../../../components/ServiceCard/ServiceCard'

interface Props {
  title: string
  subtitle: string
  viewMode: 'list' | 'map'
  onViewModeChange: (next: 'list' | 'map') => void
  services: Service[]
  mapContent: ReactNode
}

export default function HomeServiceShelf({
  title,
  subtitle,
  viewMode,
  onViewModeChange,
  services,
  mapContent,
}: Props) {
  const navigate = useNavigate()

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

      {viewMode === 'list' ? (
        <div className="flex flex-col gap-2">
          {services.map((svc) => (
            <ServiceCard key={svc.id} service={svc} />
          ))}
        </div>
      ) : (
        <Suspense
          fallback={<div className="w-full rounded-2xl bg-gray-100 animate-pulse" style={{ height: '60vh', minHeight: 320 }} />}
        >
          {mapContent}
        </Suspense>
      )}
    </motion.section>
  )
}
