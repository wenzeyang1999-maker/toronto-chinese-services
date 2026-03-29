import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, MapPin, Phone, MessageCircle, ShieldCheck, Clock, Tag, MessageSquare } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { getCategoryById } from '../../data/categories'
import type { BrowseEntry } from '../Profile/types'

function recordBrowse(entry: BrowseEntry) {
  try {
    const key = 'tcs_browse_history'
    const prev: BrowseEntry[] = JSON.parse(localStorage.getItem(key) ?? '[]')
    const filtered = prev.filter(e => e.id !== entry.id)
    localStorage.setItem(key, JSON.stringify([entry, ...filtered].slice(0, 20)))
  } catch { /* ignore */ }
}

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const services = useAppStore((s) => s.services)

  const service = services.find((s) => s.id === id)

  // Record browse history on view
  useEffect(() => {
    if (service) {
      recordBrowse({
        id: service.id,
        title: service.title,
        category: service.category,
        area: service.location.area ?? null,
        ts: Date.now(),
      })
    }
  }, [service?.id])

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
    if (!service.provider.phone) return
    window.location.href = `tel:${service.provider.phone}`
  }

  const handleWechat = async () => {
    if (!service.provider.wechat) return
    try {
      await navigator.clipboard.writeText(service.provider.wechat)
      alert(`微信号已复制：${service.provider.wechat}`)
    } catch {
      alert(`微信号：${service.provider.wechat}（请手动复制）`)
    }
  }

  const handleMessage = async () => {
    if (!user) { navigate('/login'); return }
    const providerId = service.provider.id
    if (!providerId || providerId === user.id) return
    // Upsert conversation (unique on client+provider+service)
    const { data, error } = await supabase
      .from('conversations')
      .upsert({ client_id: user.id, provider_id: providerId, service_id: service.id },
               { onConflict: 'client_id,provider_id,service_id', ignoreDuplicates: false })
      .select('id')
      .single()
    if (!error && data) {
      navigate(`/conversation/${data.id}`)
    } else if (error) {
      alert('发起对话失败，请稍后再试')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className={`${cat?.bgColor ?? 'bg-gray-50'} px-4 pt-safe`}>
        <div className="max-w-2xl lg:max-w-4xl mx-auto flex items-center gap-3 h-14">
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

      <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-4 space-y-4">
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
            {(service.tags ?? []).map((tag) => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                <Tag size={10} />
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Service images */}
        {service.images && service.images.length > 0 && (
          <ImageBlock images={service.images} />
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
                <span>加入于 {service.provider.joinedAt ? service.provider.joinedAt.slice(0, 7) : '未知'}</span>
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
        <div className="max-w-2xl lg:max-w-4xl mx-auto flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleMessage}
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-primary-300 text-primary-600 py-3 rounded-2xl font-medium hover:bg-primary-50 transition-colors"
          >
            <MessageSquare size={18} />
            <span>发消息</span>
          </motion.button>
          {service.provider.wechat && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleWechat}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-2xl font-medium hover:bg-green-600 transition-colors"
            >
              <MessageCircle size={18} />
              <span>微信</span>
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCall}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-2xl font-medium hover:bg-primary-700 transition-colors"
          >
            <Phone size={18} />
            <span>电话</span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Image block: swipe carousel on mobile, grid on desktop ────────────────────
function ImageBlock({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setCurrent(index)
  }

  // Desktop grid cols
  const cols = images.length === 1 ? 'grid-cols-1'
    : images.length === 2 ? 'grid-cols-2'
    : images.length <= 4 ? 'grid-cols-2'
    : 'grid-cols-3'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="card p-5"
    >
      <h3 className="text-sm font-semibold text-gray-700 mb-3">服务图片</h3>

      {/* Mobile: swipe carousel */}
      <div className="lg:hidden">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none rounded-xl gap-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`服务图片${i + 1}`}
              className="w-full flex-shrink-0 object-cover rounded-xl snap-start"
              style={{ aspectRatio: '4/3' }}
            />
          ))}
        </div>
        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {images.map((_, i) => (
              <span
                key={i}
                className={`rounded-full transition-all ${i === current ? 'w-4 h-1.5 bg-primary-500' : 'w-1.5 h-1.5 bg-gray-300'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: grid */}
      <div className={`hidden lg:grid gap-2 ${cols}`}>
        {images.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`服务图片${i + 1}`}
            className={`w-full object-cover rounded-xl ${images.length === 1 ? '' : 'aspect-square'}`}
          />
        ))}
      </div>
    </motion.div>
  )
}
