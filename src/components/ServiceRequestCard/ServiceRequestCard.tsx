import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, MapPin, DollarSign } from 'lucide-react'
import type { ServiceRequest } from '../../types'
import { getCategoryById } from '../../data/categories'

interface Props {
  request: ServiceRequest
  layout?: 'list' | 'masonry'
}

export default function ServiceRequestCard({ request, layout = 'list' }: Props) {
  const navigate = useNavigate()
  const cat = getCategoryById(request.category)

  const urgencyColor =
    request.daysLeft <= 3  ? 'text-red-500 bg-red-50 border-red-200' :
    request.daysLeft <= 7  ? 'text-amber-600 bg-amber-50 border-amber-200' :
                             'text-gray-500 bg-gray-50 border-gray-200'

  if (layout === 'masonry') {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/requests/${request.id}`)}
        className="bg-white rounded-2xl cursor-pointer overflow-hidden
                   border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200"
      >
        {/* Top accent bar */}
        <div className={`h-1.5 w-full ${cat?.bgColor ?? 'bg-gray-100'}`} />

        <div className="p-4 space-y-2">
          {/* Badge + title */}
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                             bg-orange-100 text-orange-600 border border-orange-200">
              求服务
            </span>
            <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
              {request.title}
            </h3>
          </div>

          {request.description && (
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
              {request.description}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 ${cat?.color ?? 'text-gray-500'}`}>
              {cat?.emoji} {cat?.label}
            </span>
            {request.budget && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                <DollarSign size={8} />
                {request.budget}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            {(request.area || request.city) && (
              <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                <MapPin size={9} />
                {request.area || request.city}
              </span>
            )}
            <span className={`ml-auto flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${urgencyColor}`}>
              <Clock size={9} />
              {request.daysLeft}天后到期
            </span>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/requests/${request.id}`)}
      className="bg-white rounded-2xl cursor-pointer flex gap-3 p-3
                 border border-gray-100 shadow-sm hover:shadow-md
                 active:bg-gray-50 transition-all duration-200"
    >
      {/* Left: category icon */}
      <div className={`w-14 h-14 flex-shrink-0 rounded-xl ${cat?.bgColor ?? 'bg-gray-100'}
                       flex items-center justify-center text-2xl`}>
        {cat?.emoji ?? '🔍'}
      </div>

      {/* Right: content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                             bg-orange-100 text-orange-600 border border-orange-200">
              求服务
            </span>
            <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1">
              {request.title}
            </h3>
          </div>
          {request.budget && (
            <span className="shrink-0 text-sm font-bold text-green-600">{request.budget}</span>
          )}
        </div>

        {request.description && (
          <p className="text-xs text-gray-400 line-clamp-1 mb-1.5">{request.description}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 ${cat?.color ?? 'text-gray-500'}`}>
            {cat?.emoji} {cat?.label}
          </span>
          {(request.area || request.city) && (
            <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
              <MapPin size={9} />
              {request.area || request.city}
            </span>
          )}
          <span className={`ml-auto flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${urgencyColor}`}>
            <Clock size={9} />
            {request.daysLeft}天后到期
          </span>
        </div>
      </div>
    </motion.div>
  )
}
