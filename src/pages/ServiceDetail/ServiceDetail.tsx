import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, MapPin, Phone, ShieldCheck, Clock, Tag, MessageSquare, CheckCircle2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { getCategoryById } from '../../data/categories'
import type { BrowseEntry } from '../../types/browse'
import ReviewsSection from './ReviewsSection'
import RelatedServices from '../../components/RelatedServices/RelatedServices'
import ReplyTimeBadge from '../../components/ReplyTimeBadge/ReplyTimeBadge'
import QASection from './QASection'
import SaveButton from '../../components/SaveButton/SaveButton'
import ShareButton from '../../components/ShareButton/ShareButton'
import PageMeta from '../../components/PageMeta/PageMeta'
import ViewCount from '../../components/ViewCount/ViewCount'
import { SOCIAL_PLATFORMS } from '../../lib/socialPlatforms'
import ContactActions from './components/ContactActions'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icons broken by Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

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
  const [socialLinks,    setSocialLinks]    = useState<Record<string, string>>({})
  const [emailVerified,  setEmailVerified]  = useState(false)
  const [phoneVerified,  setPhoneVerified]  = useState(false)
  const [providerEmail,  setProviderEmail]  = useState<string | null>(null)
  const [avgReplyHours,  setAvgReplyHours]  = useState<number | null>(null)
  const [showMap,        setShowMap]        = useState(false)
  const [showContactActions, setShowContactActions] = useState(false)

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

    supabase
      .from('users')
      .select('avg_reply_hours')
      .eq('id', service.provider.id)
      .single()
      .then(({ data }) => {
        if (data?.avg_reply_hours != null) setAvgReplyHours(data.avg_reply_hours)
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
      <PageMeta
        title={service.title}
        description={service.description?.slice(0, 120)}
        image={service.images?.[0]}
      />
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
          <SaveButton type="service" id={service.id} size={20} className="w-9 h-9" />
          <ShareButton title={service.title} size={18} className="w-9 h-9" />
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

          <ViewCount type="service" id={service.id} className="mt-2" />

          <div className="mt-4 flex flex-wrap gap-2">
            {service.provider.verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <ShieldCheck size={11} />
                已认证
              </span>
            )}
            {service.distance !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                <MapPin size={11} />
                {service.distance < 1 ? `${(service.distance * 1000).toFixed(0)}m` : `${service.distance.toFixed(1)}km`}
              </span>
            )}
            <ReplyTimeBadge
              avgReplyHours={avgReplyHours}
              joinedAt={service.provider.joinedAt || service.createdAt}
              lastSeenAt={service.provider.lastSeenAt}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">看清楚后，再一键联系</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  平台已把认证、活跃度、服务区域和联系方式放在前面，方便你快速判断。
                </p>
              </div>
              <button
                onClick={() => setShowContactActions(true)}
                className="rounded-2xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                立即联系
              </button>
            </div>
          </div>

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
            <MapPin size={16} className="text-primary-500 flex-shrink-0" />
            <span className="text-sm flex-1">{service.location.area ?? service.location.address}，{service.location.city}</span>
            {service.distance !== undefined && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                距您约 {service.distance < 1
                  ? `${(service.distance * 1000).toFixed(0)}m`
                  : `${service.distance.toFixed(1)}km`}
              </span>
            )}
            {service.location.lat != null && service.location.lng != null && (
              <button
                onClick={() => setShowMap((v) => !v)}
                className="flex-shrink-0 flex items-center gap-1 text-xs text-primary-600 font-medium
                           bg-primary-50 hover:bg-primary-100 border border-primary-200
                           px-2.5 py-1 rounded-full transition-colors"
              >
                {showMap ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showMap ? '收起' : '查看地图'}
              </button>
            )}
          </div>

          {/* Inline map — only when service has coordinates */}
          {showMap && service.location.lat != null && service.location.lng != null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-3 space-y-2"
            >
              <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 220 }}>
                <MapContainer
                  center={[service.location.lat, service.location.lng]}
                  zoom={15}
                  className="w-full h-full"
                  zoomControl={true}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[service.location.lat, service.location.lng]}>
                    <Popup>
                      <div className="text-sm space-y-1.5 py-0.5">
                        <p className="font-semibold text-gray-900 leading-snug">{service.title}</p>
                        <p className="text-gray-500 text-xs">{service.location.area ?? service.location.address}，{service.location.city}</p>
                        <a
                          href={`https://www.google.com/maps?q=${service.location.lat},${service.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center bg-primary-600 hover:bg-primary-700 text-white
                                     text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                        >
                          在 Google Maps 打开
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>

              {/* Google Maps navigation button */}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${service.location.lat},${service.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-200
                           bg-white hover:bg-gray-50 text-sm text-gray-700 font-medium transition-colors"
              >
                <span>🗺️</span>
                用 Google Maps 导航
              </a>
            </motion.div>
          )}
        </motion.div>

        {/* Q&A */}
        <QASection serviceId={service.id} providerId={service.provider.id ?? ''} />

        {/* Related services */}
        <RelatedServices currentId={service.id} categoryId={service.category} />

        {/* Reviews */}
        <ReviewsSection serviceId={service.id} providerId={service.provider.id ?? ''} />

      </div>

      {/* Bottom action bar */}
      <ContactActions
        isOpen={showContactActions}
        providerName={service.provider.name}
        phone={service.provider.phone}
        wechat={service.provider.wechat}
        onClose={() => setShowContactActions(false)}
        onMessage={() => { setShowContactActions(false); handleMessage() }}
        onCall={() => { setShowContactActions(false); handleCall() }}
        onCopyWechat={() => { setShowContactActions(false); handleWechat() }}
        onOpenProfile={() => {
          setShowContactActions(false)
          if (service.provider.id) navigate(`/provider/${service.provider.id}`)
        }}
      />
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 pb-safe">
        <div className="max-w-2xl lg:max-w-4xl mx-auto flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowContactActions(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-2xl font-medium hover:bg-primary-700 transition-colors"
          >
            <Phone size={18} />
            <span>立即联系</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => service.provider.id && navigate(`/provider/${service.provider.id}`)}
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-primary-300 text-primary-600 py-3 rounded-2xl font-medium hover:bg-primary-50 transition-colors"
          >
            <MessageSquare size={18} />
            <span>查看主页</span>
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
