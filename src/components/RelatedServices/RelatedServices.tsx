// ─── Related Services ─────────────────────────────────────────────────────────
// Shows up to 4 services in the same category, excluding the current one.
// Pure frontend — reads from appStore, no extra DB calls.
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { getCategoryById } from '../../data/categories'

interface Props {
  currentId: string
  categoryId: string
}

export default function RelatedServices({ currentId, categoryId }: Props) {
  const navigate = useNavigate()
  const services = useAppStore((s) => s.services)

  const related = services
    .filter(s => s.available && s.category === categoryId && s.id !== currentId)
    .slice(0, 4)

  if (related.length === 0) return null

  const cat = getCategoryById(categoryId as never)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          {cat?.emoji} 相关服务 · {cat?.label}
        </h3>
        <button
          onClick={() => navigate(`/search?category=${categoryId}`)}
          className="text-xs text-primary-600 flex items-center gap-0.5 hover:underline"
        >
          查看全部 <ChevronRight size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {related.map((svc) => {
          const priceLabel =
            svc.priceType === 'hourly' ? `$${svc.price}/小时` :
            svc.priceType === 'fixed'  ? `$${svc.price} 起`   : '价格面议'

          return (
            <button
              key={svc.id}
              onClick={() => navigate(`/service/${svc.id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              {/* Thumbnail */}
              {svc.images?.[0] ? (
                <img
                  src={svc.images[0]} alt={svc.title}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100"
                  loading="lazy"
                />
              ) : (
                <div className={`w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl ${cat?.bgColor ?? 'bg-gray-100'}`}>
                  {cat?.emoji}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{svc.title}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{svc.provider.name}</p>
                <p className="text-xs text-primary-600 font-medium mt-0.5">{priceLabel}</p>
              </div>

              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
