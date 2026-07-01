import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, MapPin, ShieldCheck, Zap, BadgeCheck, Phone, Crown } from 'lucide-react'
import type { Service } from '../../types'
import { getCategoryById } from '../../data/categories'
import { useReadStore } from '../../store/readStore'

interface Props {
  service: Service
  layout?: 'list' | 'masonry'
}

function getActiveLabel(lastSeenAt?: string | null): string | null {
  if (!lastSeenAt) return null
  const h = (Date.now() - new Date(lastSeenAt).getTime()) / 3_600_000
  if (h < 2)  return '刚刚活跃'
  if (h < 24) return '今日活跃'
  if (h < 168) return '本周活跃'
  return null
}

export default function ServiceCard({ service, layout = 'list' }: Props) {
  const navigate   = useNavigate()
  const cat        = getCategoryById(service.category)
  const isRead     = useReadStore((s) => s.read.has(`service:${service.id}`))
  const markRead   = useReadStore((s) => s.markRead)
  const [imgFailed, setImgFailed] = useState(false)

  function handleClick() {
    markRead('service', service.id)
    navigate(`/service/${service.id}`)
  }

  const showImage   = (service.images?.length ?? 0) > 0 && !imgFailed
  const hasReviews  = service.provider.reviewCount > 0
  const activeLabel = getActiveLabel(service.provider.lastSeenAt)

  const priceLabel =
    service.priceType === 'hourly' ? `$${service.price}/时` :
    service.priceType === 'fixed'  ? `$${service.price}起`  : '面议'

  // ── Placeholder ──────────────────────────────────────────────────────────
  const Placeholder = ({ size }: { size: 'sm' | 'lg' }) => (
    <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 ${cat?.bgColor ?? 'bg-gray-100'}`}>
      <span className={size === 'lg' ? 'text-5xl' : 'text-3xl'}>{cat?.emoji ?? '🔧'}</span>
      {size === 'lg' && (
        <span className={`text-xs font-semibold tracking-wide ${cat?.color ?? 'text-gray-500'}`}>
          {cat?.label}
        </span>
      )}
    </div>
  )

  // ── Trust badge: highest tier wins ──────────────────────────────────────
  const TrustBadge = () => service.provider.businessVerified ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      <BadgeCheck size={9} /> 商户认证
    </span>
  ) : service.provider.verified ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
      <ShieldCheck size={9} /> 平台审核
    </span>
  ) : service.provider.phoneVerified ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
      <Phone size={9} /> 电话认证
    </span>
  ) : null

  // ── Membership badge: 黄金 / 至尊 商家 (paid-tier trust + visibility signal) ──
  const MembershipBadge = () => {
    const lvl = service.provider.membershipLevel
    if (lvl === 'L3') return (
      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
        <Crown size={9} className="fill-amber-300" /> 至尊商家
      </span>
    )
    if (lvl === 'L2') return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        <Crown size={9} className="fill-amber-400" /> 黄金商家
      </span>
    )
    return null
  }

  // ── Rating row helper ─────────────────────────────────────────────────────
  const RatingBadge = () => hasReviews ? (
    <div className="flex items-center gap-0.5">
      <Star size={9} className="text-amber-400 fill-amber-400" />
      <span className="text-[11px] text-gray-600 font-medium">
        {service.provider.rating.toFixed(1)}
      </span>
      <span className="text-[10px] text-gray-400">
        ({service.provider.reviewCount})
      </span>
    </div>
  ) : null

  // ── Masonry layout ───────────────────────────────────────────────────────
  if (layout === 'masonry') {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className={`bg-white rounded-2xl cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-md active:bg-gray-50
          ${isRead ? 'opacity-75' : ''}
          ${service.isPromoted
            ? 'border-2 border-amber-400 shadow-amber-50 shadow-sm'
            : 'border border-gray-100 shadow-sm'
          }`}
      >
        <div className="relative aspect-[4/3] bg-gray-100">
          {showImage ? (
            <img
              src={service.images![0]}
              alt={service.title}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <Placeholder size="lg" />
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
            <h3 className={`font-semibold text-sm leading-snug line-clamp-2 ${isRead ? 'text-gray-400' : 'text-gray-900'}`}>
              {service.title}
            </h3>
            <span className="text-sm font-bold text-primary-600 whitespace-nowrap">{priceLabel}</span>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{service.description}</p>

          <div className="flex flex-wrap gap-1.5">
            <MembershipBadge />
            <TrustBadge />
            {activeLabel && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {activeLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0 overflow-hidden pt-1">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 ${cat?.color ?? 'text-gray-500'}`}>
              {cat?.emoji} {cat?.label}
            </span>
            <span className="text-[11px] text-gray-500 truncate">{service.provider.name}</span>
            <div className="ml-auto">
              <RatingBadge />
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── List layout (default) ────────────────────────────────────────────────
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={`bg-white rounded-2xl cursor-pointer flex items-center gap-3 p-3
                 transition-all duration-200 hover:shadow-md active:bg-gray-50
                 ${isRead ? 'opacity-75' : ''}
                 ${service.isPromoted
                   ? 'border-2 border-amber-400 shadow-amber-50 shadow-sm'
                   : 'border border-gray-100 shadow-sm'}`}
    >
      {/* Thumbnail */}
      <div className="relative w-[72px] h-[72px] flex-shrink-0 rounded-xl overflow-hidden">
        {showImage ? (
          <img
            src={service.images![0]}
            alt={service.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Placeholder size="sm" />
        )}
        {service.isPromoted && (
          <span className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-0.5 bg-amber-400/90 py-0.5">
            <Zap size={8} className="fill-white text-white" />
            <span className="text-white text-[9px] font-bold">推广</span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title + price */}
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h3 className={`font-semibold text-sm leading-snug line-clamp-1 flex-1 ${isRead ? 'text-gray-400' : 'text-gray-900'}`}>
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

        {/* Badges */}
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <MembershipBadge />
            <TrustBadge />
          {activeLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              {activeLabel}
            </span>
          )}
          {service.distance != null && service.distance > 0.05 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
              <MapPin size={9} />
              {service.distance < 1
                ? `${(service.distance * 1000).toFixed(0)}m`
                : `${service.distance.toFixed(1)}km`}
            </span>
          )}
        </div>

        {/* Bottom row: category · provider · rating · area */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 ${cat?.color ?? 'text-gray-500'}`}>
            {cat?.emoji} {cat?.label}
          </span>

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

          <RatingBadge />

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
