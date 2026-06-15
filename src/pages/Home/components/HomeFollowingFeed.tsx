import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, BadgeCheck, ShieldCheck, Phone, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../../store/appStore'
import { useFollowsStore } from '../../../store/followsStore'
import { getCategoryById } from '../../../data/categories'
import type { Service } from '../../../types'

function TrustDot({ service }: { service: Service }) {
  if (service.provider.businessVerified)
    return <BadgeCheck size={10} className="text-amber-500 flex-shrink-0" />
  if (service.provider.verified)
    return <ShieldCheck size={10} className="text-blue-500 flex-shrink-0" />
  if (service.provider.phoneVerified)
    return <Phone size={10} className="text-sky-500 flex-shrink-0" />
  return null
}

function FollowingCard({ service }: { service: Service }) {
  const navigate = useNavigate()
  const cat      = getCategoryById(service.category)

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      onClick={() => navigate(`/service/${service.id}`)}
      className="flex-shrink-0 w-[140px] cursor-pointer"
    >
      {/* Image / placeholder */}
      <div className={`w-full h-[92px] rounded-xl overflow-hidden mb-2 ${cat?.bgColor ?? 'bg-gray-100'}`}>
        {service.images?.[0] ? (
          <img
            src={service.images[0]}
            alt={service.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {cat?.emoji ?? '🔧'}
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2 mb-1">
        {service.title}
      </p>

      {/* Provider row */}
      <div className="flex items-center gap-1 min-w-0">
        <div className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <span className="text-[8px] font-bold text-primary-700">
            {service.provider.name.slice(0, 1)}
          </span>
        </div>
        <span className="text-[10px] text-gray-500 truncate flex-1">
          {service.provider.name}
        </span>
        <TrustDot service={service} />
      </div>

      {/* Rating */}
      {service.provider.reviewCount > 0 && (
        <div className="flex items-center gap-0.5 mt-0.5">
          <Star size={9} className="text-amber-400 fill-amber-400" />
          <span className="text-[10px] text-gray-500">
            {service.provider.rating.toFixed(1)}
          </span>
        </div>
      )}
    </motion.div>
  )
}

export default function HomeFollowingFeed() {
  const services  = useAppStore(s => s.services)
  const following = useFollowsStore(s => s.following)
  const isReady   = useFollowsStore(s => s.isReady)
  const navigate  = useNavigate()

  if (!isReady || following.size === 0) return null

  // Most recent services from followed providers, up to 12
  const feed = services
    .filter(s => s.available && following.has(s.provider.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12)

  if (feed.length === 0) return null

  return (
    <section className="mb-4 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">关注动态</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">你关注的服务商最新发布</p>
        </div>
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-0.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          更多
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {feed.map(service => (
            <FollowingCard key={service.id} service={service} />
          ))}
        </div>
      </div>
    </section>
  )
}
