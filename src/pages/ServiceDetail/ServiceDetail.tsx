import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, MapPin, Phone, ShieldCheck, Clock, Tag, MessageSquare, CheckCircle2, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { getCategoryById } from '../../data/categories'
import type { BrowseEntry } from '../Profile/types'
import ReviewsSection from './ReviewsSection'

// ── Social platform display config ────────────────────────────────────────────
const SOCIAL_PLATFORMS = [
  { key: 'whatsapp',    label: 'WhatsApp',  icon: '📲', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', getUrl: (v: string) => `https://wa.me/${v.replace(/\D/g, '')}` },
  { key: 'xiaohongshu', label: '小红书',    icon: '📕', color: 'bg-rose-50 text-rose-700 border-rose-200',         getUrl: (v: string) => v.startsWith('http') ? v : null },
  { key: 'instagram',   label: 'Instagram', icon: '📷', color: 'bg-pink-50 text-pink-700 border-pink-200',         getUrl: (v: string) => `https://instagram.com/${v.replace('@','')}` },
  { key: 'facebook',    label: 'Facebook',  icon: '👥', color: 'bg-blue-50 text-blue-700 border-blue-200',         getUrl: (v: string) => v.startsWith('http') ? v : `https://facebook.com/${v}` },
  { key: 'line',        label: 'Line',      icon: '🟢', color: 'bg-green-50 text-green-700 border-green-200',      getUrl: (v: string) => `https://line.me/ti/p/~${v}` },
  { key: 'telegram',    label: 'Telegram',  icon: '✈️', color: 'bg-sky-50 text-sky-700 border-sky-200',            getUrl: (v: string) => `https://t.me/${v.replace('@','')}` },
  { key: 'website',     label: '网站',      icon: '🌐', color: 'bg-violet-50 text-violet-700 border-violet-200',   getUrl: (v: string) => v.startsWith('http') ? v : `https://${v}` },
] as const

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

  // Provider extra info — fetched separately, not in global store
  const [socialLinks,   setSocialLinks]   = useState<Record<string, string>>({})
  const [emailVerified, setEmailVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [providerEmail, setProviderEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!service?.provider.id) return
    // Select columns one at a time so a missing column doesn't blank the whole card.
    // email + is_email_verified have always existed; social_links + phone_verified
    // require the latest schema migration to be applied.
    supabase
      .from('users')
      .select('email, is_email_verified')
      .eq('id', service.provider.id)
      .single()
      .then(({ data }) => {
        if (data?.email)             setProviderEmail(data.email)
        if (data?.is_email_verified) setEmailVerified(true)
      })

    supabase
      .from('users')
      .select('social_links, phone_verified')
      .eq('id', service.provider.id)
      .single()
      .then(({ data, error }) => {
        if (error) return // columns may not exist yet — silently skip
        if (data?.social_links)   setSocialLinks(data.social_links as Record<string, string>)
        if (data?.phone_verified) setPhoneVerified(true)
      })
  }, [service?.provider.id])

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
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-snug">{service.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs ${cat?.color} ${cat?.bgColor} px-2 py-0.5 rounded-full font-medium`}>
                  {cat?.label}
                </span>
                <span className="text-primary-600 font-bold">{priceLabel}</span>
              </div>
            </div>
            {/* Provider name + star rating — prominent, top-right of main card */}
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-sm font-semibold text-gray-800">{service.provider.name}</span>
              <div className="flex items-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={18}
                    className={i <= Math.round(service.provider.rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-200 fill-gray-200'} />
                ))}
              </div>
              <span className="text-xs text-gray-400 mt-0.5">
                {service.provider.reviewCount > 0
                  ? `${service.provider.rating.toFixed(1)} · ${service.provider.reviewCount}条评价`
                  : '暂无评价'}
              </span>
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

          {/* Entire identity block is one big tap target */}
          <button
            onClick={() => service.provider.id && navigate(`/provider/${service.provider.id}`)}
            className="w-full flex items-center gap-3 text-left hover:bg-gray-50 active:bg-gray-100 rounded-2xl transition-colors -mx-2 px-2 py-2"
          >
            {service.provider.avatar ? (
              <img src={service.provider.avatar} alt={service.provider.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {service.provider.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-900">{service.provider.name}</span>
                {service.provider.verified && (
                  <span className="flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                    <ShieldCheck size={10} /> 已认证
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                <Clock size={11} />
                <span>加入于 {service.provider.joinedAt ? service.provider.joinedAt.slice(0, 7) : '未知'}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                  ${emailVerified ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                  <CheckCircle2 size={10} />
                  邮箱{emailVerified ? '已验证' : '未验证'}
                </span>
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                  ${phoneVerified ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                  <CheckCircle2 size={10} />
                  手机{phoneVerified ? '已验证' : '未验证'}
                </span>
              </div>
            </div>
            <span className="text-xs text-primary-500 flex-shrink-0">查看主页 →</span>
          </button>

          {/* Contact info: email / phone / wechat */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            {providerEmail && (
              <a href={`mailto:${providerEmail}`}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600 transition-colors">
                <span className="text-base">📧</span>
                <span className="truncate">{providerEmail}</span>
              </a>
            )}
            {service.provider.phone && (
              <a href={`tel:${service.provider.phone}`}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600 transition-colors">
                <span className="text-base">📞</span>
                <span>{service.provider.phone}</span>
              </a>
            )}
            {service.provider.wechat && (
              <button onClick={handleWechat}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600 transition-colors w-full text-left">
                <span className="text-base">💬</span>
                <span>{service.provider.wechat}</span>
                <span className="text-xs text-gray-400 ml-1">（点击复制）</span>
              </button>
            )}
          </div>

          {/* Social links */}
          {SOCIAL_PLATFORMS.some(p => socialLinks[p.key]?.trim()) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.filter(p => socialLinks[p.key]?.trim()).map(p => {
                const url = p.getUrl(socialLinks[p.key])
                return url ? (
                  <a key={p.key} href={url} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${p.color}`}>
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span key={p.key}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${p.color}`}>
                    <span>{p.icon}</span>
                    <span>{socialLinks[p.key]}</span>
                  </span>
                )
              })}
            </div>
          )}
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

        {/* Reviews */}
        <ReviewsSection serviceId={service.id} providerId={service.provider.id ?? ''} />

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
