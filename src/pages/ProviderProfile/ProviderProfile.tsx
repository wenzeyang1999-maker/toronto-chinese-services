// ─── Provider Public Profile Page ─────────────────────────────────────────────
// Route: /provider/:id
// Shows a provider's public info + all their active listings.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, MessageSquare, Phone, ShieldCheck, Star, Briefcase, DollarSign, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { getCategoryById } from '../../data/categories'
import MembershipBadge, { type MemberLevel } from '../../components/MembershipBadge/MembershipBadge'
import { JOB_CATEGORY_CONFIG, JOB_TYPE_CONFIG, SALARY_TYPE_LABEL, getCategoryLabel } from '../Jobs/types'
import type { Job } from '../Jobs/types'
import { LISTING_TYPE_CONFIG as RE_LISTING_TYPE_CONFIG, PROPERTY_TYPE_CONFIG, getPriceLabel as getPropertyPriceLabel } from '../RealEstate/types'
import type { Property } from '../RealEstate/types'
import { SECONDHAND_CATEGORY_CONFIG, ITEM_CONDITION_CONFIG, getPriceLabel as getItemPriceLabel } from '../Secondhand/types'
import type { SecondhandItem } from '../Secondhand/types'

// ── Social platform display config (mirrors ServiceDetail) ────────────────────
const SOCIAL_PLATFORMS = [
  { key: 'whatsapp',    label: 'WhatsApp',  icon: '📲', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', getUrl: (v: string) => `https://wa.me/${v.replace(/\D/g, '')}` },
  { key: 'xiaohongshu', label: '小红书',    icon: '📕', color: 'bg-rose-50 text-rose-700 border-rose-200',         getUrl: (v: string) => v.startsWith('http') ? v : null },
  { key: 'instagram',   label: 'Instagram', icon: '📷', color: 'bg-pink-50 text-pink-700 border-pink-200',         getUrl: (v: string) => `https://instagram.com/${v.replace('@', '')}` },
  { key: 'facebook',    label: 'Facebook',  icon: '👥', color: 'bg-blue-50 text-blue-700 border-blue-200',         getUrl: (v: string) => v.startsWith('http') ? v : `https://facebook.com/${v}` },
  { key: 'line',        label: 'Line',      icon: '🟢', color: 'bg-green-50 text-green-700 border-green-200',      getUrl: (v: string) => `https://line.me/ti/p/~${v}` },
  { key: 'telegram',    label: 'Telegram',  icon: '✈️', color: 'bg-sky-50 text-sky-700 border-sky-200',            getUrl: (v: string) => `https://t.me/${v.replace('@', '')}` },
  { key: 'website',     label: '网站',      icon: '🌐', color: 'bg-violet-50 text-violet-700 border-violet-200',   getUrl: (v: string) => v.startsWith('http') ? v : `https://${v}` },
] as const

interface ProviderUser {
  id: string
  name: string
  avatar_url: string | null
  email: string
  phone: string | null
  wechat: string | null
  is_email_verified: boolean
  phone_verified: boolean
  social_links: Record<string, string>
  created_at: string
  membership_level: MemberLevel
}

interface ProviderReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  service: { id: string; title: string } | null
  reviewer: { id: string; name: string; avatar_url: string | null } | null
}

interface ServiceRow {
  id: string
  title: string
  description: string
  category_id: string
  price: number | null
  price_type: string | null
  area: string | null
  images: string[]
}

export default function ProviderProfile() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [provider,        setProvider]       = useState<ProviderUser | null>(null)
  const [services,        setServices]       = useState<ServiceRow[]>([])
  const [providerReviews, setProviderReviews] = useState<ProviderReview[]>([])
  const [jobs,            setJobs]           = useState<Job[]>([])
  const [jobTab,          setJobTab]         = useState<'hiring' | 'seeking'>('hiring')
  const [properties,      setProperties]     = useState<Property[]>([])
  const [secondhandItems, setSecondhandItems] = useState<SecondhandItem[]>([])
  const [loading,         setLoading]        = useState(true)
  const [notFound,        setNotFound]       = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    // Fetch core user profile (columns that always exist)
    supabase
      .from('users')
      .select('id, name, avatar_url, email, phone, wechat, is_email_verified, created_at')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return }
        setProvider({
          ...data,
          phone_verified: false,
          social_links: {},
          membership_level: 'L1',
        })
        setLoading(false)
      })

    // Fetch newer columns separately — silently skip if migration not yet run
    supabase
      .from('users')
      .select('phone_verified, social_links, membership_level')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return
        setProvider(prev => prev ? {
          ...prev,
          phone_verified: data.phone_verified ?? false,
          social_links: (data.social_links as Record<string, string>) ?? {},
          membership_level: (data.membership_level as MemberLevel) ?? 'L1',
        } : prev)
      })

    // Fetch their active property listings
    supabase
      .from('properties')
      .select('*')
      .eq('poster_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setProperties(data.map(p => ({ ...p, images: p.images ?? [] })) as Property[])
      })

    // Fetch their active secondhand listings
    supabase
      .from('secondhand')
      .select('*')
      .eq('seller_id', id)
      .eq('is_active', true)
      .eq('is_sold', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSecondhandItems(data.map(i => ({ ...i, images: i.images ?? [] })) as SecondhandItem[])
      })

    // Fetch their active job posts (hiring + seeking)
    supabase
      .from('jobs')
      .select('*')
      .eq('poster_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setJobs(data.map(j => ({ ...j, listing_type: j.listing_type ?? 'hiring' })) as Job[])
      })

    // Fetch their active services, then load reviews for those services
    supabase
      .from('services')
      .select('id, title, description, category_id, price, price_type, area, images')
      .eq('provider_id', id)
      .eq('is_available', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = data?.map(r => ({ ...r, images: r.images ?? [] })) ?? []
        setServices(rows)

        if (rows.length === 0) return
        const serviceIds = rows.map(r => r.id)
        supabase
          .from('reviews')
          .select('id, rating, comment, created_at, service:service_id(id, title), reviewer:reviewer_id(id, name, avatar_url)')
          .in('service_id', serviceIds)
          .order('created_at', { ascending: false })
          .then(({ data: rData }) => {
            if (!rData) return
            setProviderReviews(rData.map((r: any) => ({
              id:         r.id,
              rating:     r.rating,
              comment:    r.comment,
              created_at: r.created_at,
              service:    Array.isArray(r.service)  ? r.service[0]  : r.service,
              reviewer:   Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
            })))
          })
      })
  }, [id])

  async function handleMessage() {
    if (!user) { navigate('/login'); return }
    if (!provider || provider.id === user.id) return
    // Open messages section — no specific service context
    navigate('/profile?section=messages')
  }

  async function handleMessageService(serviceId: string) {
    if (!user) { navigate('/login'); return }
    if (!provider || provider.id === user.id) return
    const { data, error } = await supabase
      .from('conversations')
      .upsert({ client_id: user.id, provider_id: provider.id, service_id: serviceId },
               { onConflict: 'client_id,provider_id,service_id', ignoreDuplicates: false })
      .select('id')
      .single()
    if (!error && data) navigate(`/conversation/${data.id}`)
  }

  async function copyWechat() {
    if (!provider?.wechat) return
    try {
      await navigator.clipboard.writeText(provider.wechat)
      alert(`微信号已复制：${provider.wechat}`)
    } catch {
      alert(`微信号：${provider.wechat}（请手动复制）`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        加载中…
      </div>
    )
  }

  if (notFound || !provider) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-500">
        <p>用户不存在</p>
        <button onClick={() => navigate(-1)} className="text-primary-600 text-sm">返回</button>
      </div>
    )
  }

  const joinedMonth = provider.created_at.slice(0, 7)
  const isOwnProfile = user?.id === provider.id

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800 flex-1 truncate">{provider.name}</span>
      </div>

      <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-5 space-y-4">

        {/* ── Profile card ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">

          {/* Avatar + name row */}
          <div className="flex items-center gap-4">
            {provider.avatar_url ? (
              <img src={provider.avatar_url} alt={provider.name}
                className="w-20 h-20 rounded-full object-cover flex-shrink-0 border border-gray-100" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                              flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
                {provider.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 truncate">{provider.name}</h1>
                <MembershipBadge level={provider.membership_level} size="md" />
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                <Clock size={12} />
                <span>加入于 {joinedMonth}</span>
              </div>

              {/* Verification badges */}
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                  ${provider.is_email_verified ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                  <CheckCircle2 size={10} />
                  邮箱{provider.is_email_verified ? '已验证' : '未验证'}
                </span>
                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                  ${provider.phone_verified ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                  <CheckCircle2 size={10} />
                  手机{provider.phone_verified ? '已验证' : '未验证'}
                </span>
                {services.length > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-blue-600 bg-blue-50">
                    <ShieldCheck size={10} />
                    {services.length} 项服务
                  </span>
                )}
                {jobs.length > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-purple-600 bg-purple-50">
                    <Briefcase size={10} />
                    {jobs.length} 个职位
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact info */}
          {(provider.email || provider.phone || provider.wechat) && (
            <div className="mt-5 pt-4 border-t border-gray-100 space-y-2.5">
              {provider.email && (
                <a href={`mailto:${provider.email}`}
                  className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-primary-600 transition-colors">
                  <span className="text-lg">📧</span>
                  <span className="truncate">{provider.email}</span>
                </a>
              )}
              {provider.phone && (
                <a href={`tel:${provider.phone}`}
                  className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-primary-600 transition-colors">
                  <Phone size={16} className="text-primary-400 flex-shrink-0" />
                  <span>{provider.phone}</span>
                </a>
              )}
              {provider.wechat && (
                <button onClick={copyWechat}
                  className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-primary-600 transition-colors w-full text-left">
                  <span className="text-lg">💬</span>
                  <span>{provider.wechat}</span>
                  <span className="text-xs text-gray-400 ml-1">（点击复制）</span>
                </button>
              )}
            </div>
          )}

          {/* Social links */}
          {SOCIAL_PLATFORMS.some(p => provider.social_links[p.key]?.trim()) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.filter(p => provider.social_links[p.key]?.trim()).map(p => {
                const url = p.getUrl(provider.social_links[p.key])
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
                    <span>{provider.social_links[p.key]}</span>
                  </span>
                )
              })}
            </div>
          )}

          {/* Message button — only for other users */}
          {!isOwnProfile && (
            <button onClick={handleMessage}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-primary-600 text-white
                         py-3 rounded-2xl font-medium hover:bg-primary-700 active:scale-[0.98] transition-all">
              <MessageSquare size={18} />
              发消息给 {provider.name}
            </button>
          )}
        </motion.div>

        {/* ── Services ─────────────────────────────────────────────────────── */}
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
                  {/* Image */}
                  {svc.images.length > 0 && (
                    <button onClick={() => navigate(`/service/${svc.id}`)} className="w-full text-left block">
                      <div className="w-full aspect-square overflow-hidden">
                        <img src={svc.images[0]} alt={svc.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      </div>
                    </button>
                  )}

                  <div className="p-4">
                    {/* Category + price row */}
                    <div className="flex items-center gap-2 mb-2">
                      {cat && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color} ${cat.bgColor}`}>
                          {cat.label}
                        </span>
                      )}
                      {svc.area && (
                        <span className="text-xs text-gray-400">{svc.area}</span>
                      )}
                      <span className="ml-auto text-primary-600 font-bold text-sm">{priceLabel}</span>
                    </div>

                    {/* Title */}
                    <button onClick={() => navigate(`/service/${svc.id}`)}
                      className="text-sm font-semibold text-gray-900 text-left hover:text-primary-600 transition-colors w-full line-clamp-2 leading-snug">
                      {svc.title}
                    </button>

                    {/* Description */}
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {svc.description}
                    </p>

                    {/* Stars + action row */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={13} className="text-yellow-400 fill-yellow-400" />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/service/${svc.id}`)}
                          className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                          查看详情
                        </button>
                        {!isOwnProfile && (
                          <button onClick={() => handleMessageService(svc.id)}
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

        {/* ── Jobs ─────────────────────────────────────────────────────────── */}
        {jobs.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
              发布的职位（{jobs.length}）
            </h2>

            {/* Hiring / Seeking sub-tabs */}
            {jobs.some(j => j.listing_type === 'hiring') && jobs.some(j => j.listing_type === 'seeking') && (
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-3">
                {(['hiring', 'seeking'] as const).map(t => (
                  <button key={t} onClick={() => setJobTab(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      jobTab === t ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t === 'hiring' ? '💼 招聘' : '🙋 求职'}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {jobs
                .filter(j => {
                  const hasBoth = jobs.some(x => x.listing_type === 'hiring') && jobs.some(x => x.listing_type === 'seeking')
                  return hasBoth ? j.listing_type === jobTab : true
                })
                .map((job, i) => {
                  const salaryLabel = job.salary_type === 'negotiable'
                    ? '薪资面议'
                    : job.salary_min && job.salary_max
                      ? `$${job.salary_min}–$${job.salary_max}${SALARY_TYPE_LABEL[job.salary_type]}`
                      : job.salary_min ? `$${job.salary_min} 起${SALARY_TYPE_LABEL[job.salary_type]}` : '薪资面议'

                  return (
                    <motion.div key={job.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer
                                 hover:border-primary-200 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm leading-snug flex-1">{job.title}</h3>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${JOB_TYPE_CONFIG[job.job_type].color}`}>
                          {JOB_TYPE_CONFIG[job.job_type].label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {JOB_CATEGORY_CONFIG[job.category].emoji} {getCategoryLabel(job)}
                        </span>
                        <span className="text-sm font-bold text-primary-600">{salaryLabel}</span>
                        {job.area && job.area.length > 0 && (
                          <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
                            <MapPin size={10} />{job.area.join('·')}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )
                })
              }
            </div>
          </div>
        )}

        {/* ── Properties ───────────────────────────────────────────────────── */}
        {properties.length > 0 && (
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
                      ? <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">{PROPERTY_TYPE_CONFIG[p.property_type].emoji}</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0 py-3 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${RE_LISTING_TYPE_CONFIG[p.listing_type].color}`}>
                        {RE_LISTING_TYPE_CONFIG[p.listing_type].label}
                      </span>
                      <span className="text-sm font-bold text-primary-600">{getPropertyPriceLabel(p)}</span>
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
        )}

        {/* ── Secondhand ────────────────────────────────────────────────────── */}
        {secondhandItems.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
              发布的闲置（{secondhandItems.length}）
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {secondhandItems.map((item, i) => (
                <motion.div key={item.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/secondhand/${item.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                             cursor-pointer hover:border-primary-200 hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {item.images.length > 0
                      ? <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-3xl">
                          {SECONDHAND_CATEGORY_CONFIG[item.category].emoji}
                        </div>
                    }
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold text-primary-600 mb-0.5">{getItemPriceLabel(item)}</p>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</p>
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ITEM_CONDITION_CONFIG[item.condition].color}`}>
                      {ITEM_CONDITION_CONFIG[item.condition].label}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── All Reviews ──────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
            收到的评价（{providerReviews.length}）
            {providerReviews.length > 0 && (
              <span className="ml-2 text-yellow-500 font-bold">
                {'★ ' + (providerReviews.reduce((s, r) => s + r.rating, 0) / providerReviews.length).toFixed(1)}
              </span>
            )}
          </h2>

          {providerReviews.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
              暂无评价
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              <AnimatePresence>
                {providerReviews.map((r, i) => (
                  <motion.div key={r.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex gap-3 p-4"
                  >
                    {r.reviewer?.avatar_url ? (
                      <img src={r.reviewer.avatar_url} alt={r.reviewer.name}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                      flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {r.reviewer?.name?.charAt(0) ?? '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">
                          {r.reviewer?.name ?? '匿名用户'}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={12}
                              className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
                      </div>
                      {r.service && (
                        <button onClick={() => navigate(`/service/${r.service!.id}`)}
                          className="text-xs text-primary-500 hover:underline mt-0.5">
                          {r.service.title}
                        </button>
                      )}
                      {r.comment && (
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">{r.comment}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
