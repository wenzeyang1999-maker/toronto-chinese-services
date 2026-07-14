// ─── Provider Public Profile Page ─────────────────────────────────────────────
// Route: /provider/:id
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCopy } from '../../hooks/useCopy'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import type { MemberLevel } from '../../components/MembershipBadge/MembershipBadge'
import { ProviderProfileSkeleton } from '../../components/Skeleton/Skeleton'
import PageMeta from '../../components/PageMeta/PageMeta'
import type { Job } from '../Jobs/types'
import type { Property } from '../RealEstate/types'
import type { SecondhandItem } from '../Secondhand/types'
import type { Event } from '../Events/types'
import type { ProviderUser, ProviderReview, ServiceRow } from './types'
import ProfileCard from './components/ProfileCard'
import ServicesGrid from './components/ServicesGrid'
import JobsSection from './components/JobsSection'
import PropertiesSection from './components/PropertiesSection'
import SecondhandSection from './components/SecondhandSection'
import EventsSection from './components/EventsSection'
import ReviewsSection from './components/ReviewsSection'

export default function ProviderProfile() {
  const { copy } = useCopy()
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [provider,        setProvider]       = useState<ProviderUser | null>(null)
  const [services,        setServices]       = useState<ServiceRow[]>([])
  const [providerReviews, setProviderReviews] = useState<ProviderReview[]>([])
  const [jobs,            setJobs]           = useState<Job[]>([])
  const [properties,      setProperties]     = useState<Property[]>([])
  const [secondhandItems, setSecondhandItems] = useState<SecondhandItem[]>([])
  const [events,          setEvents]         = useState<Event[]>([])
  const [loading,         setLoading]        = useState(true)
  const [notFound,        setNotFound]       = useState(false)
  const [orderCount,      setOrderCount]     = useState(0)
  const [followerCount,   setFollowerCount]  = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    async function load() {
      // Contact (phone/wechat) is fetched via the authorized get_contact RPC —
      // the base columns are REVOKEd from clients (see contact_rpcs migration).
      const extSelect = 'is_online, business_type, skill_tags, qualification_note, qualification_images, has_license, has_insurance'
      const [
        { data: profile, error: profileError },
        { data: svcsData },
        { data: propertiesData },
        { data: secondhandData },
        { data: eventsData },
        { data: jobsData },
        { count: followCount },
        { data: ext },
        { data: contact },
        { data: orderCnt },
      ] = await Promise.all([
        supabase.from('public_profiles')
          .select('id, name, avatar_url, bio, created_at, is_email_verified, last_seen_at, phone_verified, social_links, membership_level, business_verified, avg_reply_hours, credit_penalty')
          .eq('id', id).single(),
        supabase.from('services')
          .select('id, title, description, category_id, price, price_type, area, images, reviews:reviews(id, rating, comment, created_at, reply:review_replies(content), reviewer:reviewer_id(id, name, avatar_url))')
          .eq('provider_id', id).eq('is_available', true).order('created_at', { ascending: false }),
        supabase.from('properties')
          .select('*').eq('poster_id', id).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('secondhand')
          .select('*').eq('seller_id', id).eq('is_active', true).eq('is_sold', false).order('created_at', { ascending: false }),
        supabase.from('events')
          .select('*').eq('poster_id', id).eq('is_active', true).order('event_date', { ascending: true }),
        supabase.from('jobs')
          .select('*').eq('poster_id', id).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('follows')
          .select('id', { count: 'exact', head: true }).eq('provider_id', id),
        supabase.from('users')
          .select(extSelect)
          .eq('id', id!).single(),
        user
          ? supabase.rpc('get_contact', { p_target: id }).returns<{ phone: string; wechat: string; email: string }[]>().maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.rpc('provider_order_count', { p_provider: id }),
      ])

      if (profileError || !profile) { setNotFound(true); setLoading(false); return }
      setOrderCount((orderCnt as number) ?? 0)

      // `.select(dynamicString)` widens the row type, so read via a cast record.
      const extRow = (ext ?? null) as Record<string, unknown> | null
      const contactRow = (contact ?? null) as { phone?: string; wechat?: string; email?: string } | null

      setProvider({
        ...profile,
        email: contactRow?.email ?? '',   // email now via authorized get_contact, not the public view
        bio: profile.bio ?? null,
        phone: contactRow?.phone ?? null,
        wechat: contactRow?.wechat ?? null,
        phone_verified: profile.phone_verified ?? false,
        social_links: (profile.social_links as Record<string, string>) ?? {},
        membership_level: (profile.membership_level as MemberLevel) ?? 'L1',
        business_verified: profile.business_verified ?? false,
        avg_reply_hours: profile.avg_reply_hours ?? null,
        is_online: (extRow?.is_online as boolean) ?? false,
        business_type: (extRow?.business_type as 'individual' | 'business') ?? 'individual',
        skill_tags: (extRow?.skill_tags as string[]) ?? [],
        qualification_note: (extRow?.qualification_note as string) ?? '',
        qualification_images: (extRow?.qualification_images as string[]) ?? [],
        has_license: (extRow?.has_license as boolean) ?? false,
        has_insurance: (extRow?.has_insurance as boolean) ?? false,
        credit_penalty: (profile.credit_penalty as number) ?? 0,
      })

      if (svcsData) {
        setServices(svcsData.map(r => {
          const reviews = (r as any).reviews ?? []
          const avgRating = reviews.length
            ? reviews.reduce((s: number, rv: any) => s + rv.rating, 0) / reviews.length
            : null
          return { ...r, images: r.images ?? [], avgRating, reviewCount: reviews.length }
        }))
        const allReviews: ProviderReview[] = svcsData.flatMap(svc =>
          ((svc as any).reviews ?? []).map((r: any) => ({
            id:         r.id,
            rating:     r.rating,
            comment:    r.comment,
            created_at: r.created_at,
            service:    { id: svc.id, title: svc.title },
            reviewer:   Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
            reply:      Array.isArray(r.reply) ? (r.reply[0]?.content ?? null) : (r.reply?.content ?? null),
          }))
        )
        allReviews.sort((a, b) => b.rating - a.rating || b.created_at.localeCompare(a.created_at))
        setProviderReviews(allReviews)
      }
      if (propertiesData) setProperties(propertiesData.map(p => ({ ...p, images: p.images ?? [] })) as Property[])
      if (secondhandData) setSecondhandItems(secondhandData.map(i => ({ ...i, images: i.images ?? [] })) as SecondhandItem[])
      if (eventsData) setEvents(eventsData.map(e => ({ ...e, images: e.images ?? [] })) as Event[])
      if (jobsData) setJobs(jobsData.map(j => ({ ...j, listing_type: j.listing_type ?? 'hiring' })) as Job[])
      if (followCount !== null) setFollowerCount(followCount)

      setLoading(false)
    }

    load()
  }, [id, user?.id])

  async function handleMessage() {
    if (!user) { navigate('/login'); return }
    if (!provider || provider.id === user.id) return
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_provider_id: provider.id,
      p_client_id:   user.id,
      p_service_id:  null,
    })
    if (error || !data) { navigate('/profile?section=messages'); return }
    navigate(`/conversation/${data}`)
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

  const copyWechat = () => copy(provider?.wechat, {
    toastMsg: '微信号已复制 ✓',
    fallback: `微信号：${provider?.wechat}（请手动复制）`,
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400">
            <ArrowLeft size={22} />
          </button>
          <div className="h-4 w-32 bg-gray-200 animate-pulse rounded-lg" />
        </div>
        <ProviderProfileSkeleton />
      </div>
    )
  }

  if (notFound || !provider) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
            <ArrowLeft size={22} />
          </button>
          <span className="text-sm font-semibold text-gray-700">服务商主页</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-5xl">🔍</div>
          <h2 className="text-lg font-bold text-gray-800">找不到这个服务商</h2>
          <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
            该主页可能已被删除或链接已失效。<br />你可以回首页重新搜索。
          </p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              返回上一页
            </button>
            <button onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
              回首页
            </button>
          </div>
        </div>
      </div>
    )
  }

  const joinedMonth  = provider.created_at.slice(0, 7)
  const isOwnProfile = user?.id === provider.id

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageMeta
        title={`${provider.name} — 华邻服务商`}
        description={provider.bio ?? `查看 ${provider.name} 的服务、招聘、房源和闲置信息`}
      />

      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800 flex-1 truncate">{provider.name}</span>
      </div>

      <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-5 space-y-4">
        <ProfileCard
          provider={provider}
          followerCount={followerCount}
          isOwnProfile={isOwnProfile}
          joinedMonth={joinedMonth}
          orderCount={orderCount}
          onMessage={handleMessage}
          onCopyWechat={copyWechat}
        />

        {/* Category quick-nav — sticky jump bar, only when 2+ content types exist */}
        {(() => {
          const tabs = [
            { key: 'services',   label: '服务', show: services.length > 0 },
            { key: 'jobs',       label: '招聘', show: jobs.length > 0 },
            { key: 'properties', label: '房源', show: properties.length > 0 },
            { key: 'secondhand', label: '闲置', show: secondhandItems.length > 0 },
            { key: 'events',     label: '活动', show: events.length > 0 },
            { key: 'reviews',    label: '评价', show: providerReviews.length > 0 },
          ].filter(t => t.show)
          if (tabs.length < 2) return null
          return (
            <div className="sticky top-14 z-10 -mx-4 px-4 py-2 bg-white/95 backdrop-blur border-b border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide">
              {tabs.map(t => (
                <button key={t.key}
                  onClick={() => document.getElementById(`pp-${t.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-primary-100 hover:text-primary-600 transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
          )
        })()}

        <div id="pp-services" className="scroll-mt-28">
          <ServicesGrid
            services={services}
            isOwnProfile={isOwnProfile}
            onMessageService={handleMessageService}
          />
        </div>

        {jobs.length > 0 && <div id="pp-jobs" className="scroll-mt-28"><JobsSection jobs={jobs} /></div>}

        {properties.length > 0 && <div id="pp-properties" className="scroll-mt-28"><PropertiesSection properties={properties} /></div>}

        {secondhandItems.length > 0 && <div id="pp-secondhand" className="scroll-mt-28"><SecondhandSection items={secondhandItems} /></div>}

        {events.length > 0 && <div id="pp-events" className="scroll-mt-28"><EventsSection events={events} /></div>}

        <div id="pp-reviews" className="scroll-mt-28">
          <ReviewsSection reviews={providerReviews} />
        </div>
      </div>
    </div>
  )
}
