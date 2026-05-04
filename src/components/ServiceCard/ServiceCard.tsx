import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, MapPin, ShieldCheck, Zap, Clock3 } from 'lucide-react'
import type { Service } from '../../types'
import { getCategoryById } from '../../data/categories'

interface Props {
  service: Service
  layout?: 'list' | 'masonry'
}

export default function ServiceCard({ service, layout = 'list' }: Props) {
  const navigate    = useNavigate()
  const cat         = getCategoryById(service.category)
  const hasImage    = (service.images?.length ?? 0) > 0
  const hasReviews  = service.provider.reviewCount > 0
  const isRecentlyActive = service.provider.lastSeenAt
    ? Date.now() - new Date(service.provider.lastSeenAt).getTime() < 24 * 60 * 60 * 1000
    : false

  const priceLabel =
    service.priceType === 'hourly' ? `$${service.price}/时` :
    service.priceType === 'fixed'  ? `$${service.price}起`  : '面议'

  if (layout === 'masonry') {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/service/${service.id}`)}
        className={`bg-white rounded-2xl cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-md active:bg-gray-50 ${
          service.isPromoted
            ? 'border-2 border-amber-400 shadow-amber-50 shadow-sm'
            : 'border border-gray-100 shadow-sm'
        }`}
      >
        <div className="relative aspect-[4/3] bg-gray-100">
          {hasImage ? (
            <img src={service.images![0]} alt={service.title} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full ${cat?.bgColor ?? 'bg-gray-100'} flex items-center justify-center`}>
              {cat?.image
                ? <img src={cat.image} alt="" className="w-14 h-14 object-contain opacity-40" />
                : <span className="text-4xl opacity-30">{cat?.emoji}</span>}
            </div>
          )}
          {service.isPromoted && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-bold text-white shadow-sm">
              <Zap size={10} className="fill-white" />
              推广
            </span>
          )}
        </div>

        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{service.title}</h3>
            <span className="text-sm font-bold text-primary-600 whitespace-nowrap">{priceLabel}</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{service.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {service.provider.verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                <ShieldCheck size={9} />
                已认证
              </span>
            )}
            {isRecentlyActive && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <Clock3 size={9} />
                近期活跃
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0 overflow-hidden pt-1">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 ${cat?.color ?? 'text-gray-500'}`}>
              {cat?.emoji} {cat?.label}
            </span>
            <span className="text-[11px] text-gray-500 truncate">{service.provider.name}</span>
            {hasReviews && (
              <div className="flex items-center gap-0.5 ml-auto">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                <span className="text-[11px] text-gray-500">{service.provider.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

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

        <div className="mb-2 flex flex-wrap gap-1.5">
          {service.provider.verified && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              <ShieldCheck size={9} />
              已认证
            </span>
          )}
          {isRecentlyActive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <Clock3 size={9} />
              近期活跃
            </span>
          )}
          {service.distance != null && service.distance > 0.05 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
              <MapPin size={9} />
              {service.distance < 1 ? `直线 ${(service.distance * 1000).toFixed(0)}m` : `直线 ${service.distance.toFixed(1)}km`}
            </span>
          )}
        </div>

        {/* Bottom row: provider + category + rating + area */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
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

          {/* Area — show only first region to avoid overflow */}
          {service.location?.area && (
            <div className="flex items-center gap-0.5 text-gray-400 ml-auto flex-shrink-0">
              <MapPin size={9} />
              <span className="text-[11px] truncate max-w-[90px]">
                {service.location.area.split(/[、,]/)[0].trim()}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
