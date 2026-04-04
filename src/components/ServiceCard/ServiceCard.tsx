import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, MapPin, ShieldCheck, Zap } from 'lucide-react'
import type { Service } from '../../types'
import { getCategoryById } from '../../data/categories'

interface Props {
  service: Service
}

export default function ServiceCard({ service }: Props) {
  const navigate  = useNavigate()
  const cat       = getCategoryById(service.category)
  const hasImage  = (service.images?.length ?? 0) > 0
  const hasReviews = service.provider.reviewCount > 0

  const priceLabel =
    service.priceType === 'hourly' ? `$${service.price}/时` :
    service.priceType === 'fixed'  ? `$${service.price}起`  : '面议'

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate(`/service/${service.id}`)}
      className={`bg-white rounded-2xl overflow-hidden shadow-sm transition-all duration-300 cursor-pointer group w-full
                 hover:shadow-lg hover:-translate-y-0.5
                 ${service.isPromoted ? 'border-2 border-amber-400 shadow-amber-100' : 'border border-gray-100'}`}
    >
      {/* ── Hero image ─────────────────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] overflow-hidden">

        {hasImage ? (
          <img
            src={service.images![0]}
            alt={service.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          /* Styled no-image placeholder */
          <div className={`w-full h-full ${cat?.bgColor ?? 'bg-gray-100'}
                           flex flex-col items-center justify-center gap-2`}>
            {cat?.image
              ? <img src={cat.image} alt="" className="w-12 h-12 object-contain opacity-30" />
              : <span className="text-4xl opacity-25">{cat?.emoji}</span>
            }
          </div>
        )}

        {/* Dark gradient at bottom of image */}
        <div className="absolute inset-x-0 bottom-0 h-14
                        bg-gradient-to-t from-black/50 to-transparent" />

        {/* Category pill — top left */}
        <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1
                          px-2 py-0.5 rounded-full text-[11px] font-semibold
                          bg-white/90 backdrop-blur-sm shadow-sm ${cat?.color}`}>
          <span>{cat?.emoji}</span>
          <span>{cat?.label}</span>
        </span>

        {/* Promoted badge — top right */}
        {service.isPromoted && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-0.5
                           px-2 py-0.5 rounded-full text-[11px] font-bold
                           bg-amber-400 text-white shadow">
            <Zap size={10} className="fill-white" />
            推广
          </span>
        )}

        {/* Price — top right (when not promoted) */}
        {!service.isPromoted && (
          <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full
                           text-[11px] font-bold bg-primary-600 text-white shadow">
            {priceLabel}
          </span>
        )}

        {/* Rating — bottom left of image (only when reviews exist) */}
        {hasReviews && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1
                           px-2 py-0.5 rounded-full bg-black/35 backdrop-blur-sm">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="text-white text-[11px] font-semibold">
              {service.provider.rating.toFixed(1)}
            </span>
            <span className="text-white/65 text-[10px]">
              ({service.provider.reviewCount})
            </span>
          </span>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="p-3">

        <h3 className="font-semibold text-gray-900 text-[13px] leading-snug line-clamp-2 mb-1">
          {service.title}
        </h3>

        <p className="text-[11px] text-gray-400 line-clamp-1 mb-2.5 leading-relaxed">
          {service.description}
        </p>

        {/* Provider row */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Avatar initial */}
            <div className="w-[18px] h-[18px] rounded-full bg-primary-100 flex items-center
                            justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-primary-700 leading-none">
                {service.provider.name.slice(0, 1)}
              </span>
            </div>
            <span className="text-[11px] text-gray-600 truncate">
              {service.provider.name}
            </span>
            {service.provider.verified && (
              <ShieldCheck size={11} className="text-blue-500 flex-shrink-0" />
            )}
          </div>

          {service.location?.area && (
            <div className="flex items-center gap-0.5 text-gray-400 flex-shrink-0">
              <MapPin size={10} />
              <span className="text-[11px]">{service.location?.area}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
