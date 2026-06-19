import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ServiceRow } from '../types'
import { getCategoryById } from '../../../data/categories'
import ImgFallback from '../../../components/ImgFallback/ImgFallback'

interface Props {
  services: ServiceRow[]
  isOwnProfile: boolean
  onMessageService: (id: string) => void
}

export default function ServicesGrid({ services, isOwnProfile, onMessageService }: Props) {
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
        发布的服务（{services.length}）
      </h2>

      {services.length === 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">
          暂无发布的服务
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {services.map((svc, i) => {
          const cat = getCategoryById(svc.category_id as never)
          const priceLabel =
            svc.price_type === 'hourly'  ? `$${svc.price}/小时` :
            svc.price_type === 'fixed'   ? `$${svc.price} 起`  : '价格面议'

          return (
            <motion.div key={svc.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {svc.images.length > 0 && (
                <button onClick={() => navigate(`/service/${svc.id}`)} className="w-full text-left block">
                  <div className="w-full aspect-square overflow-hidden">
                    <ImgFallback
                      src={svc.images[0]}
                      alt={svc.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      fallback={<div className="w-full h-full bg-gray-100 flex items-center justify-center text-3xl">🔧</div>}
                    />
                  </div>
                </button>
              )}

              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {cat && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color} ${cat.bgColor}`}>
                      {cat.label}
                    </span>
                  )}
                  {svc.area && <span className="text-xs text-gray-400">{svc.area}</span>}
                  <span className="ml-auto text-primary-600 font-bold text-sm">{priceLabel}</span>
                </div>

                <button onClick={() => navigate(`/service/${svc.id}`)}
                  className="text-sm font-semibold text-gray-900 text-left hover:text-primary-600 transition-colors w-full line-clamp-2 leading-snug">
                  {svc.title}
                </button>

                <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {svc.description}
                </p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-0.5">
                    {svc.reviewCount === 0 ? (
                      <span className="text-xs text-gray-400">暂无评价</span>
                    ) : (
                      <>
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={13}
                            className={s <= Math.round(svc.avgRating ?? 0)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-200 fill-gray-200'} />
                        ))}
                        <span className="text-[11px] text-gray-400 ml-0.5">({svc.reviewCount})</span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/service/${svc.id}`)}
                      className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      查看详情
                    </button>
                    {!isOwnProfile && (
                      <button onClick={() => onMessageService(svc.id)}
                        className="text-xs px-3 py-1.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors">
                        发消息
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
