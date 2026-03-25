import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, MapPin, MessageCircle, Phone, ShieldCheck } from 'lucide-react'
import type { Service } from '../../types'
import { getCategoryById } from '../../data/categories'

interface Props {
  service: Service
}

export default function ServiceCard({ service }: Props) {
  const navigate = useNavigate()
  const cat = getCategoryById(service.category)

  const priceLabel =
    service.priceType === 'hourly'
      ? `$${service.price}/小时`
      : service.priceType === 'fixed'
      ? `$${service.price} 起`
      : '价格面议'

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/service/${service.id}`)}
      className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        {/* Category badge */}
        <div className={`${cat?.bgColor ?? 'bg-gray-50'} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}>
          <img src={cat?.image} alt={cat?.label} className="w-8 h-8 object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 flex-1">
              {service.title}
            </h3>
            <span className="text-primary-600 font-bold text-sm whitespace-nowrap">{priceLabel}</span>
          </div>

          {/* Description */}
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
            {service.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-2">
            {service.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <span className="text-xs font-medium text-gray-800">{service.provider.name}</span>
                {service.provider.verified && (
                  <ShieldCheck size={12} className="text-blue-500" />
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <Star size={11} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs text-gray-600">{service.provider.rating}</span>
                <span className="text-xs text-gray-400">({service.provider.reviewCount})</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-gray-400">
              {service.distance !== undefined && (
                <span className="flex items-center gap-0.5 text-xs">
                  <MapPin size={11} />
                  {service.distance < 1
                    ? `${(service.distance * 1000).toFixed(0)}m`
                    : `${service.distance.toFixed(1)}km`}
                </span>
              )}
              {service.provider.wechat && (
                <MessageCircle size={14} className="text-green-500" />
              )}
              <Phone size={14} className="text-blue-400" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
