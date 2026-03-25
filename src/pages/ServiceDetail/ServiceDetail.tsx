import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, MapPin, Phone, MessageCircle, ShieldCheck, Clock, Tag } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { getCategoryById } from '../../data/categories'

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const services = useAppStore((s) => s.services)

  const service = services.find((s) => s.id === id)

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        服务不存在
      </div>
    )
  }

  const cat = getCategoryById(service.category)
  const priceLabel =
    service.priceType === 'hourly'
      ? `$${service.price}/小时`
      : service.priceType === 'fixed'
      ? `$${service.price} 起`
      : '价格面议'

  const handleCall = () => {
    window.location.href = `tel:${service.provider.phone}`
  }

  const handleWechat = () => {
    if (service.provider.wechat) {
      navigator.clipboard.writeText(service.provider.wechat)
      alert(`微信号已复制：${service.provider.wechat}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className={`${cat?.bgColor ?? 'bg-gray-50'} px-4 pt-safe`}>
        <div className="max-w-2xl mx-auto flex items-center gap-3 h-14">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex-1 truncate">
            服务详情
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className={`${cat?.bgColor ?? 'bg-gray-50'} w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <img src={cat?.image} alt={cat?.label} className="w-10 h-10 object-contain" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 leading-snug">{service.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs ${cat?.color} ${cat?.bgColor} px-2 py-0.5 rounded-full font-medium`}>
                  {cat?.label}
                </span>
                <span className="text-primary-600 font-bold">{priceLabel}</span>
              </div>
            </div>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed">{service.description}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {service.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                <Tag size={10} />
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Service images */}
        {service.images && service.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="card p-5"
          >
            <h3 className="text-sm font-semibold text-gray-700 mb-3">服务图片</h3>
            <div className="grid grid-cols-3 gap-2">
              {service.images.map((img, i) => (
                <img key={i} src={img} alt={`服务图片${i + 1}`} className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          </motion.div>
        )}

        {/* Provider card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-3">服务提供者</h3>
          <div className="flex items-center gap-3">
            {service.provider.avatar ? (
              <img src={service.provider.avatar} alt={service.provider.name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {service.provider.name.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900">{service.provider.name}</span>
                {service.provider.verified && (
                  <span className="flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                    <ShieldCheck size={10} />
                    已认证
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-0.5">
                  <Star size={13} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-medium">{service.provider.rating}</span>
                  <span className="text-xs text-gray-400">({service.provider.reviewCount}条评价)</span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                <Clock size={11} />
                <span>加入于 {service.provider.joinedAt.slice(0, 7)}</span>
                <span className="mx-1">·</span>
                <span>语言：{service.provider.languages.join('、')}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Location card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-5"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-2">服务区域</h3>
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin size={16} className="text-primary-500" />
            <span className="text-sm">{service.location.area ?? service.location.address}，{service.location.city}</span>
            {service.distance !== undefined && (
              <span className="ml-auto text-xs text-gray-400">
                距您约 {service.distance < 1
                  ? `${(service.distance * 1000).toFixed(0)}m`
                  : `${service.distance.toFixed(1)}km`}
              </span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto flex gap-3">
          {service.provider.wechat && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleWechat}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-2xl font-medium hover:bg-green-600 transition-colors"
            >
              <MessageCircle size={18} />
              <span>微信联系</span>
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCall}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-2xl font-medium hover:bg-primary-700 transition-colors"
          >
            <Phone size={18} />
            <span>电话联系</span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
