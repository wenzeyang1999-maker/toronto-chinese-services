import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Property } from '../../RealEstate/types'
import { LISTING_TYPE_CONFIG, PROPERTY_TYPE_CONFIG, getPriceLabel } from '../../RealEstate/types'
import ImgFallback from '../../../components/ImgFallback/ImgFallback'

interface Props {
  properties: Property[]
}

export default function PropertiesSection({ properties }: Props) {
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
        发布的房源（{properties.length}）
      </h2>
      <div className="space-y-2">
        {properties.map((p, i) => (
          <motion.div key={p.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => navigate(`/realestate/${p.id}`)}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                       cursor-pointer hover:border-primary-200 hover:shadow-md transition-all flex gap-3"
          >
            <div className="w-20 h-20 flex-shrink-0 bg-gray-100 overflow-hidden">
              {p.images.length > 0
                ? <ImgFallback
                    src={p.images[0]}
                    alt={p.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    fallback={<div className="w-full h-full flex items-center justify-center text-2xl">{PROPERTY_TYPE_CONFIG[p.property_type].emoji}</div>}
                  />
                : <div className="w-full h-full flex items-center justify-center text-2xl">{PROPERTY_TYPE_CONFIG[p.property_type].emoji}</div>
              }
            </div>
            <div className="flex-1 min-w-0 py-3 pr-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${LISTING_TYPE_CONFIG[p.listing_type].color}`}>
                  {LISTING_TYPE_CONFIG[p.listing_type].label}
                </span>
                <span className="text-sm font-bold text-primary-600">{getPriceLabel(p)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 line-clamp-1">{p.title}</p>
              {p.area && p.area.length > 0 && (
                <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                  <MapPin size={10} />{p.area.join('·')}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
