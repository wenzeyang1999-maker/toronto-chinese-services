import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { calcDistance } from '../../lib/geo'
import HeroBanner from '../../components/HeroBanner/HeroBanner'
import CategoryButtons from '../../components/CategoryButtons/CategoryButtons'
import InquiryModal from '../../components/InquiryModal/InquiryModal'
import { useAppStore } from '../../store/appStore'
import { useGeolocation } from '../../hooks/useGeolocation'
import RecommendedServices from '../../components/RecommendedServices/RecommendedServices'
import ServiceRequestCard from '../../components/ServiceRequestCard/ServiceRequestCard'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import HomeActionHero from './components/HomeActionHero'
import HomeServiceShelf from './components/HomeServiceShelf'
import HomeFollowingFeed from './components/HomeFollowingFeed'
import PullIndicator from '../../components/PullToRefresh/PullIndicator'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { RADIUS_MIN_KM, RADIUS_MAX_KM } from '../../components/RadiusSlider/RadiusSlider'
import { PlusCircle, Search as SearchIcon, ChevronRight, Sparkles, Megaphone, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getCategoryById } from '../../data/categories'
import { fuzzyFilterRequests } from '../../lib/fuzzySearch'

const ServiceMap = lazy(() => import('../../components/ServiceMap/ServiceMap'))

export default function Home() {
  const requestLocation = useGeolocation()
  const services         = useAppStore((s) => s.services)
  const serviceRequests  = useAppStore((s) => s.serviceRequests)
  const setSearchFilters = useAppStore((s) => s.setSearchFilters)
  const userLocation     = useAppStore((s) => s.userLocation)
  const servicesHasMore  = useAppStore((s) => s.servicesHasMore)
  const servicesLoadingMore = useAppStore((s) => s.servicesLoadingMore)
  const fetchServices    = useAppStore((s) => s.fetchServices)
  const navigate         = useNavigate()
  const user             = useAuthStore((s) => s.user)
  const [searchParams]   = useSearchParams()

  // Pull-to-refresh (mobile) — re-fetch the services feed from the top.
  const { distance, refreshing, threshold } = usePullToRefresh(() => fetchServices())
  const [inquiryOpen, setInquiryOpen]  = useState(false)
  const [searchQuery, setSearchQuery]  = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>(() => {
    const saved = localStorage.getItem('tcs_view_mode')
    return saved === 'list' || saved === 'map' ? saved : 'list'
  })
  const searchRef = useRef<HTMLDivElement>(null)

  // Detect if current user is a provider (has published at least one service)
  const isProvider = useMemo(
    () => !!user && services.some((s) => s.provider.id === user.id),
    [user, services]
  )

  // Feed mode: persist to localStorage; first visit defaults by provider status
  const [feedMode, setFeedMode] = useState<'services' | 'requests'>(() => {
    const saved = localStorage.getItem('tcs_feed_mode')
    return saved === 'requests' || saved === 'services' ? saved : 'services'
  })
  const [requestSearch, setRequestSearch] = useState('')
  useEffect(() => {
    if (!localStorage.getItem('tcs_feed_mode')) {
      setFeedMode(isProvider ? 'requests' : 'services')
    }
  }, [isProvider])

  // Provider's own skill tags — used to fuzzy-match request title/description
  const [mySkillTags, setMySkillTags] = useState<string[]>([])
  useEffect(() => {
    if (!user) { setMySkillTags([]); return }
    let cancelled = false
    supabase.from('users').select('skill_tags').eq('id', user.id).single()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setMySkillTags((data?.skill_tags as string[]) ?? [])
      })
    return () => { cancelled = true }
  }, [user])

  // Map radius (km) for the map views — continuous slider, persisted to localStorage
  const [mapRadiusKm, setMapRadiusKm] = useState<number>(() => {
    const saved = Number(localStorage.getItem('tcs_map_radius_km'))
    return saved >= RADIUS_MIN_KM && saved <= RADIUS_MAX_KM ? saved : 5
  })
  const handleMapRadius = (km: number) => {
    setMapRadiusKm(km)
    localStorage.setItem('tcs_map_radius_km', String(km))
  }

  // "发现客户" unread badge — counts requests created after the provider last
  // visited the tab, that also match their skill_tags (if any).
  const requestsSeenKey = user ? `tcs_requests_last_seen_${user.id}` : ''
  const [requestsSeenAt, setRequestsSeenAt] = useState<number>(() => {
    if (!user) return Date.now()
    return Number(localStorage.getItem(`tcs_requests_last_seen_${user.id}`)) || 0
  })
  // Reset whenever the logged-in user changes (incl. logout → null) so the
  // unread badge doesn't carry over from the previous account.
  useEffect(() => {
    if (!user) {
      setRequestsSeenAt(Date.now())
      return
    }
    setRequestsSeenAt(Number(localStorage.getItem(`tcs_requests_last_seen_${user.id}`)) || 0)
  }, [user?.id])

  const unreadRequestCount = useMemo(() => {
    if (!user) return 0
    return serviceRequests.filter(r => {
      if (new Date(r.createdAt).getTime() <= requestsSeenAt) return false
      if (mySkillTags.length === 0) return true
      const cat = getCategoryById(r.category)
      const haystack = (
        r.title + ' ' + (r.description ?? '') + ' ' +
        (cat?.label ?? '') + ' ' + (cat?.searchTags ?? []).join(' ')
      ).toLowerCase()
      return mySkillTags.some(tag => tag && haystack.includes(tag.toLowerCase()))
    }).length
  }, [serviceRequests, requestsSeenAt, mySkillTags, user])

  // Mark all current requests as seen when the user lands on the requests feed
  useEffect(() => {
    if (feedMode !== 'requests' || !user || !requestsSeenKey) return
    const now = Date.now()
    localStorage.setItem(requestsSeenKey, String(now))
    setRequestsSeenAt(now)
  }, [feedMode, user, requestsSeenKey])

  const handleSetFeedMode = (mode: 'services' | 'requests') => {
    setFeedMode(mode)
    localStorage.setItem('tcs_feed_mode', mode)
  }

  // Scroll to search bar when coming from tabs
  useEffect(() => {
    if (searchParams.get('from') !== 'tabs') return
    const scroll = () => {
      if (!searchRef.current) return
      const top = searchRef.current.getBoundingClientRect().top + window.scrollY - 110
      window.scrollTo({ top, behavior: 'smooth' })
    }
    const t = setTimeout(scroll, 50)
    return () => clearTimeout(t)
  }, [searchParams])

  const handleSearch = (kw: string) => {
    if (!kw.trim()) return
    setSearchFilters({ keyword: kw.trim(), category: undefined })
    navigate(`/search?q=${encodeURIComponent(kw.trim())}`)
  }

  const handleViewMode = (next: 'list' | 'map') => {
    setViewMode(next)
    localStorage.setItem('tcs_view_mode', next)
    if (next === 'map' && !userLocation) requestLocation()
  }

  const recent = userLocation
    ? services
        .filter((s) => s.available && s.location.lat != null && s.location.lng != null)
        .map((s) => ({
          ...s,
          distance: calcDistance(userLocation.lat, userLocation.lng, s.location.lat!, s.location.lng!),
        }))
        .sort((a, b) => {
          if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1
          return (a.distance ?? Infinity) - (b.distance ?? Infinity)
        })
        .slice(0, 4)
    : services.filter((s) => s.available).slice(0, 4)

  const MAX_MAP_MARKERS = 40
  const MAP_RADIUS_KM   = 25
  const nearbyForMap = useMemo(() => {
    const available = services.filter(
      (s) => s.available && s.location.lat != null && s.location.lng != null
    )
    if (!userLocation) return available.slice(0, MAX_MAP_MARKERS)
    return available
      .map((s) => ({
        ...s,
        _dist: calcDistance(userLocation.lat, userLocation.lng, s.location.lat!, s.location.lng!),
      }))
      .filter((s) => s._dist <= MAP_RADIUS_KM)
      .sort((a, b) => {
        if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1
        return a._dist - b._dist
      })
      .slice(0, MAX_MAP_MARKERS)
  }, [services, userLocation])

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <div className="fixed top-14 left-0 right-0 z-[45] pointer-events-none">
        <PullIndicator distance={distance} refreshing={refreshing} threshold={threshold} />
      </div>
      <div className="sticky top-0 z-40">
        <HeroBanner />
      </div>

      <div ref={searchRef}>
        <HomeActionHero
          userHasLocation={!!userLocation}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearch={handleSearch}
          onOpenInquiry={() => setInquiryOpen(true)}
        />
      </div>

      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />

      <div className="relative z-10 w-full bg-[#f7f8fa] pt-6">
      <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">

        {/* Category buttons */}
        <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-gray-800">热门服务</h3>
            <button
              onClick={() => navigate('/search')}
              className="flex items-center gap-0.5 text-xs font-semibold text-primary-600 hover:text-primary-700 flex-shrink-0 transition-colors"
            >
              更多服务
              <ChevronRight size={14} />
            </button>
          </div>
          <CategoryButtons />
        </section>

        {/* ── Post-request CTA ─────────────────────────────────────────────── */}
        <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-600 bg-primary-50 border border-primary-100 px-2.5 py-1 rounded-full mb-2">
                <Megaphone size={11} /> 发需求 · 商家来找你
              </div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">1 分钟告诉我们你要什么</h3>
              <p className="text-xs text-gray-400 mt-1">附近商家看到后主动联系你 · 比挨家挨家问省一半时间</p>
            </div>
            <PlusCircle size={28} className="text-gray-200 flex-shrink-0 mt-0.5" />
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { key: 'urgent',   icon: '🔥', label: '紧急单' },
              { key: 'today',    icon: '⏰', label: '今天就要' },
              { key: 'week',     icon: '📅', label: '本周内'   },
              { key: 'flexible', icon: '💬', label: '慢慢找'   },
            ].map(chip => (
              <button
                key={chip.key}
                onClick={() => navigate(`/requests/post?urgency=${chip.key}`)}
                className="flex flex-col items-center justify-center gap-0.5 bg-gray-50 hover:bg-primary-50
                           border border-gray-200 hover:border-primary-300
                           rounded-xl py-2.5 text-[11px] font-semibold text-gray-600 hover:text-primary-600
                           transition-colors active:scale-95"
              >
                <span className="text-base leading-none">{chip.icon}</span>
                {chip.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/requests/post')}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                       text-white py-3 rounded-xl text-sm font-bold transition-colors active:scale-[0.98]"
          >
            <PlusCircle size={16} />
            立即发布需求
            <ArrowRight size={16} />
          </button>
        </section>

        {/* ── Feed mode toggle — headline dual-marketplace switcher ──────────── */}
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-3">
            {/* 找服务 */}
            <button
              onClick={() => handleSetFeedMode('services')}
              aria-pressed={feedMode === 'services'}
              className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] bg-white
                ${feedMode === 'services' ? 'border-primary-500 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                ${feedMode === 'services' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                <SearchIcon size={18} strokeWidth={2.4} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${feedMode === 'services' ? 'text-primary-700' : 'text-gray-700'}`}>找服务</p>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">附近商家 · 师傅</p>
              </div>
            </button>

            {/* 发现客户 */}
            <button
              onClick={() => handleSetFeedMode('requests')}
              aria-pressed={feedMode === 'requests'}
              className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] bg-white
                ${feedMode === 'requests' ? 'border-amber-500 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                ${feedMode === 'requests' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                <Sparkles size={18} strokeWidth={2.4} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${feedMode === 'requests' ? 'text-amber-700' : 'text-gray-700'}`}>发现客户</p>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">接附近订单 · 赚钱</p>
              </div>
              {unreadRequestCount > 0 && (
                <span className="absolute top-2 right-2 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                  {unreadRequestCount > 99 ? '99+' : unreadRequestCount}
                </span>
              )}
              {feedMode !== 'requests' && unreadRequestCount === 0 && (
                <span className="absolute top-2 right-2 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">NEW</span>
              )}
            </button>
          </div>

        </div>

        {/* ── Services feed ────────────────────────────────────────────────── */}
        {feedMode === 'services' && (
          <>
            <HomeServiceShelf
              title={userLocation ? '附近服务' : '本地热门'}
              subtitle={
                userLocation
                  ? '优先展示离你更近、且填写了精确位置的服务。切到地图可直接看分布。'
                  : '先按本地可用服务浏览。需要距离和地图时，再开启位置权限。'
              }
              viewMode={viewMode}
              onViewModeChange={handleViewMode}
              services={recent}
              allServices={services.filter((s) => s.available)}
              defaultMapServices={nearbyForMap}
              mapContent={(filtered, mapKeyword) => {
                // Distance filter — keep services within mapRadiusKm of the user
                const radiusFiltered = userLocation
                  ? filtered.filter(s => {
                      if (s.location.lat == null || s.location.lng == null) return true
                      return calcDistance(userLocation.lat, userLocation.lng, s.location.lat, s.location.lng) <= mapRadiusKm
                    })
                  : filtered
                return (
                  <ServiceMap
                    services={radiusFiltered}
                    count={radiusFiltered.length}
                    keyword={mapKeyword}
                    radiusKm={mapRadiusKm}
                    onRadiusChange={handleMapRadius}
                  />
                )
              }}
            />
            {viewMode === 'list' && servicesHasMore && (
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => fetchServices(true)}
                  disabled={servicesLoadingMore}
                  className="px-6 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-semibold
                             text-gray-700 hover:bg-gray-50 active:scale-95 transition-all
                             disabled:opacity-60 disabled:cursor-wait shadow-sm"
                >
                  {servicesLoadingMore ? '加载中…' : '加载更多服务'}
                </button>
              </div>
            )}
            <HomeFollowingFeed />
            <RecommendedServices excludeIds={recent.map(s => s.id)} />
          </>
        )}

        {/* ── Requests feed ────────────────────────────────────────────────── */}
        {feedMode === 'requests' && (() => {
          const kw = requestSearch.trim()

          // Step 1: fuzzy search — handles synonyms, typos, cross-language matching
          const filtered = fuzzyFilterRequests(serviceRequests, kw)

          // Step 2: skill-tag filter for map (keeps all for card grid)
          const tagFiltered = mySkillTags.length > 0
            ? filtered.filter(r => {
                const cat = getCategoryById(r.category)
                const haystack = (
                  r.title + ' ' +
                  (r.description ?? '') + ' ' +
                  (cat?.label ?? '') + ' ' +
                  (cat?.searchTags ?? []).join(' ')
                ).toLowerCase()
                return mySkillTags.some(tag => tag && haystack.includes(tag.toLowerCase()))
              })
            : filtered

          // Step 3: radius filter for map + cap at 25 nearest pins
          const MAX_REQUEST_PINS = 25
          const forMap = (userLocation
            ? tagFiltered
                .filter(r => r.lat != null && r.lng != null)
                .map(r => ({ r, d: calcDistance(userLocation.lat, userLocation.lng, r.lat!, r.lng!) }))
                .filter(({ d }) => d <= mapRadiusKm)
                .sort((a, b) => a.d - b.d)
                .slice(0, MAX_REQUEST_PINS)
                .map(({ r }) => r)
            : tagFiltered
                .filter(r => r.lat != null && r.lng != null)
                .slice(0, MAX_REQUEST_PINS)
          )

          // Card grid: all keyword-filtered, sorted by distance
          const forList = filtered
            .map(r => ({
              req: r,
              dist: (userLocation && r.lat != null && r.lng != null)
                ? calcDistance(userLocation.lat, userLocation.lng, r.lat, r.lng)
                : undefined,
            }))
            .sort((a, b) => {
              if (a.dist == null && b.dist == null) return 0
              if (a.dist == null) return 1
              if (b.dist == null) return -1
              return a.dist - b.dist
            })

          return (
            <section className="mb-6">
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800">附近求服务</h3>
                  <p className="text-xs text-gray-400 mt-0.5">客户发布的服务需求，主动出击接单</p>
                </div>
              </div>

              {/* Search bar */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-4 shadow-sm">
                <SearchIcon size={15} className="text-gray-400 flex-shrink-0" />
                <input
                  value={requestSearch}
                  onChange={e => setRequestSearch(e.target.value)}
                  placeholder="搜索需求关键词，如：搬家、报税、接送…"
                  className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
                />
                {requestSearch && (
                  <button onClick={() => setRequestSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                )}
              </div>

              {/* Map — always visible */}
              <Suspense fallback={<div className="h-80 rounded-2xl bg-gray-100 animate-pulse" />}>
                <ServiceMap
                  services={[]}
                  requests={forMap}
                  count={forMap.length}
                  requestsOnly
                  radiusKm={mapRadiusKm}
                  onRadiusChange={handleMapRadius}
                />
              </Suspense>
              {mySkillTags.length > 0 ? (
                <p className="text-xs text-gray-400 mt-2 mb-4 text-center truncate">
                  已按你的标签过滤：{mySkillTags.slice(0, 3).join('、')}{mySkillTags.length > 3 ? '…' : ''}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-2 mb-4 text-center">
                  💡 在「我的主页 → 业务标签」设置标签，地图将自动按你能接的单类型过滤
                </p>
              )}

              {/* Card grid — always visible below map */}
              {forList.length === 0 ? (
                <div className="card p-10 flex flex-col items-center gap-3 text-center">
                  <span className="text-4xl">{kw ? '🔍' : '📭'}</span>
                  <p className="text-sm font-semibold text-gray-600">
                    {kw ? `没有找到"${requestSearch}"相关需求` : '暂无客户需求'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {kw ? '换个关键词试试' : '告诉身边的客户来这里发布需求吧'}
                  </p>
                </div>
              ) : (
                <>
                  {kw && (
                    <p className="text-xs text-gray-400 mb-2">
                      找到 <strong className="text-gray-700">{forList.length}</strong> 条相关需求
                    </p>
                  )}
                  <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
                    {forList.map(({ req, dist }) => (
                      <div key={req.id} className="break-inside-avoid mb-3">
                        <ServiceRequestCard request={req} layout="masonry" distance={dist} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )
        })()}

      </div>
      </div>
    </div>
  )
}
