// ─── Provider Public Profile Page ─────────────────────────────────────────────
// Route: /provider/:id
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from '../../lib/toast'
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
  const [followerCount,   setFollowerCount]  = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    async function load() {
      const [
        { data: profile, error: profileError },
        { data: svcsData },
        { data: propertiesData },
        { data: secondhandData },
        { data: eventsData },
        { data: jobsData },
        { count: followCount },
        { data: ext },
      ] = await Promise.all([
        supabase.from('public_profiles')
          .select('id, name, avatar_url, email, bio, created_at, is_email_verified, last_seen_at, phone_verified, social_links, membership_level, business_verified, avg_reply_hours')
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
          .select('is_online, business_type, skill_tags, qualification_note, qualification_images, credit_penalty')
          .eq('id', id!).single(),
      ])

      if (profileError || !profile) { setNotFound(true); setLoading(false); return }

      setProvider({
        ...profile,
        bio: profile.bio ?? null,
        phone: null,
        wechat: null,
        phone_verified: profile.phone_verified ?? false,
        social_links: (profile.social_links as Record<string, string>) ?? {},
        membership_level: (profile.membership_level as MemberLevel) ?? 'L1',
        business_verified: profile.business_verified ?? false,
        avg_reply_hours: profile.avg_reply_hours ?? null,
        is_online: ext?.is_online ?? false,
        business_type: (ext?.business_type as 'individual' | 'business') ?? 'individual',
        skill_tags: (ext?.skill_tags as string[]) ?? [],
        qualification_note: (ext?.qualification_note as string) ?? '',
        qualification_images: (ext?.qualification_images as string[]) ?? [],
        credit_penalty: (ext?.credit_penalty as number) ?? 0,
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
  }, [id])

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

  async function copyWechat() {
    if (!provider?.wechat) return
    try {
      await navigator.clipboard.writeText(provider.wechat)
      toast('微信号已复制 ✓', 'success')
    } catch {
      toast(`微信号：${provider.wechat}（请手动复制）`)
    }
  }

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
        title={`${provider.name} — 华林服务商`}
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
          onMessage={handleMessage}
          onCopyWechat={copyWechat}
        />

        <ServicesGrid
          services={services}
          isOwnProfile={isOwnProfile}
          onMessageService={handleMessageService}
        />

        {jobs.length > 0 && <JobsSection jobs={jobs} />}

        {properties.length > 0 && <PropertiesSection properties={properties} />}

        {secondhandItems.length > 0 && <SecondhandSection items={secondhandItems} />}

        {events.length > 0 && <EventsSection events={events} />}

        <ReviewsSection reviews={providerReviews} />
      </div>
    </div>
  )
}
