import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, MapPin, ShieldCheck, Zap } from 'lucide-react'
import type { Service } from '../../types'
import { getCategoryById } from '../../data/categories'

interface Props {
  service: Service
}

export default function ServiceCard({ service }: Props) {
  const navigate    = useNavigate()
  const cat         = getCategoryById(service.category)
  const hasImage    = (service.images?.length ?? 0) > 0
  const hasReviews  = service.provider.reviewCount > 0

  const priceLabel =
    service.priceType === 'hourly' ? `$${service.price}/时` :
    service.priceType === 'fixed'  ? `$${service.price}起`  : '面议'

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/service/${service.id}`)}
      className={`bg-white rounded-2xl cursor-pointer flex items-center gap-3 p-3
                 transition-all duration-200 hover:shadow-md active:bg-gray-50
                 ${service.isPromoted
                   ? 'border-2 border-amber-400 shadow-amber-50 shadow-sm'
                   : 'border border-gray-100 shadow-sm'}`}
    >
      {/* ── Thumbnail ───────────────────────────────────────────────────────── */}
      <div className="relative w-[72px] h-[72px] flex-shrink-0 rounded-xl overflow-hidden">
        {hasImage ? (
          <img
            src={service.images![0]}
            alt={service.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full ${cat?.bgColor ?? 'bg-gray-100'}
                           flex items-center justify-center`}>
            {cat?.image
              ? <img src={cat.image} alt="" className="w-8 h-8 object-contain opacity-40" />
              : <span className="text-2xl opacity-30">{cat?.emoji}</span>
            }
          </div>
        )}
        {service.isPromoted && (
          <span className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-0.5
                           bg-amber-400/90 py-0.5">
            <Zap size={8} className="fill-white text-white" />
            <span className="text-white text-[9px] font-bold">推广</span>
          </span>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1 flex-1">
            {service.title}
          </h3>
          <span className="flex-shrink-0 text-sm font-bold text-primary-600 whitespace-nowrap">
            {priceLabel}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-400 line-clamp-1 mb-1.5 leading-relaxed">
          {service.description}
        </p>

        {/* Bottom row: provider + category + rating + area */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category pill */}
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full
                            text-[10px] font-semibold bg-gray-100 ${cat?.color ?? 'text-gray-500'}`}>
            {cat?.emoji} {cat?.label}
          </span>

          {/* Provider */}
          <div className="flex items-center gap-1 min-w-0">
            <div className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] font-bold text-primary-700 leading-none">
                {service.provider.name.slice(0, 1)}
              </span>
            </div>
            <span className="text-[11px] text-gray-500 truncate max-w-[80px]">
              {service.provider.name}
            </span>
            {service.provider.verified && (
              <ShieldCheck size={10} className="text-blue-500 flex-shrink-0" />
            )}
          </div>

          {/* Rating */}
          {hasReviews && (
            <div className="flex items-center gap-0.5">
              <Star size={9} className="text-amber-400 fill-amber-400" />
              <span className="text-[11px] text-gray-500">
                {service.provider.rating.toFixed(1)}
              </span>
            </div>
          )}

          {/* Area */}
          {service.location?.area && (
            <div className="flex items-center gap-0.5 text-gray-400 ml-auto flex-shrink-0">
              <MapPin size={9} />
              <span className="text-[11px]">{service.location.area}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
