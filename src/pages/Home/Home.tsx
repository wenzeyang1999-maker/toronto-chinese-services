import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import HeroBanner from '../../components/HeroBanner/HeroBanner'
import CategoryButtons from '../../components/CategoryButtons/CategoryButtons'
import InquiryModal from '../../components/InquiryModal/InquiryModal'
import SectionTabs, { type SectionTab } from '../../components/SectionTabs/SectionTabs'
import { useAppStore } from '../../store/appStore'
import { useGeolocation } from '../../hooks/useGeolocation'
// import RecentCategories from '../../components/RecentCategories/RecentCategories'  // hidden — see below
import RecommendedServices from '../../components/RecommendedServices/RecommendedServices'
import ServiceRequestCard from '../../components/ServiceRequestCard/ServiceRequestCard'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import HomeActionHero from './components/HomeActionHero'
import HomeServiceShelf from './components/HomeServiceShelf'
import { PlusCircle, Search as SearchIcon, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getCategoryById } from '../../data/categories'

const ServiceMap = lazy(() => import('../../components/ServiceMap/ServiceMap'))

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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
  const [inquiryOpen, setInquiryOpen]  = useState(false)
  const [activeTab, setActiveTab]      = useState<SectionTab>('services')
  const [searchQuery, setSearchQuery]  = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>(() => {
    const saved = localStorage.getItem('tcs_view_mode')
    return saved === 'list' || saved === 'map' ? saved : 'map'
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

  // Map radius (km) for the "发现客户" map view — persisted to localStorage
  const [mapRadiusKm, setMapRadiusKm] = useState<number>(() => {
    const saved = Number(localStorage.getItem('tcs_map_radius_km'))
    return saved === 3 || saved === 5 || saved === 10 ? saved : 5
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
  useEffect(() => {
    if (!user) return
    setRequestsSeenAt(Number(localStorage.getItem(`tcs_requests_last_seen_${user.id}`)) || 0)
  }, [user])

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
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-40">
        <HeroBanner />
        <div className="bg-white border-b border-gray-100">
          <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
            <SectionTabs active={activeTab} onChange={setActiveTab} containerClassName="px-0" />
          </div>
        </div>
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

      <div className="relative z-10 w-full bg-gray-50 pt-6">
      <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">

        {/* Category buttons */}
        <section className="card p-4 mb-4">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="text-base font-semibold text-gray-800">热门服务</h3>
            <button
              onClick={() => navigate('/search')}
              className="flex items-center gap-0.5 text-sm font-semibold text-primary-600 hover:text-primary-700 flex-shrink-0 transition-colors"
            >
              更多服务
              <ChevronRight size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">选择你需要的板块，找服务·看房·论坛·二手一站搞定。</p>
          <CategoryButtons />
        </section>

        {/* RecentCategories hidden — redundant with the 热门服务 category grid
            above. Component kept for possible future reuse (e.g. 猜你喜欢). */}
        {/* <RecentCategories /> */}

        {/* ── Feed mode toggle ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => handleSetFeedMode('services')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${feedMode === 'services'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              找服务
            </button>
            <button
              onClick={() => handleSetFeedMode('requests')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${feedMode === 'requests'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              发现客户
              {unreadRequestCount > 0 && (
                <span className="ml-1.5 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                  {unreadRequestCount > 99 ? '99+' : unreadRequestCount}
                </span>
              )}
            </button>
          </div>
          {feedMode === 'requests' && (
            <button
              onClick={() => navigate('/requests/post')}
              className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-orange-600
                         bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl hover:bg-orange-100 transition-colors"
            >
              <PlusCircle size={14} /> 发布需求
            </button>
          )}
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
                  <>
                    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-3 shadow-sm flex items-center gap-3">
                      <span className="text-xs text-gray-500 flex-shrink-0">距离范围</span>
                      <div className="flex gap-1">
                        {[3, 5, 10].map(km => (
                          <button key={km}
                            onClick={() => handleMapRadius(km)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                              mapRadiusKm === km
                                ? 'bg-primary-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {km} km
                          </button>
                        ))}
                      </div>
                      {!userLocation && (
                        <span className="text-[11px] text-gray-400 flex-1 truncate">
                          开启定位后按距离筛选
                        </span>
                      )}
                    </div>
                    <ServiceMap
                      services={radiusFiltered}
                      count={radiusFiltered.length}
                      keyword={mapKeyword}
                    />
                  </>
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
            <RecommendedServices />
          </>
        )}

        {/* ── Requests feed ────────────────────────────────────────────────── */}
        {feedMode === 'requests' && (() => {
          const kw = requestSearch.trim().toLowerCase()

          // Step 1: search keyword filter (works in both list + map view)
          let filtered = kw
            ? serviceRequests.filter(r =>
                r.title.toLowerCase().includes(kw) ||
                (r.description ?? '').toLowerCase().includes(kw) ||
                r.category.toLowerCase().includes(kw) ||
                (r.area ?? '').toLowerCase().includes(kw)
              )
            : serviceRequests

          // Step 2 (map view only): fuzzy-match against the provider's own skill_tags.
          // If the user hasn't set any tags, show everything. If tags exist, keep only
          // requests whose title / description / category-label contains at least one tag.
          const tagFiltered = (viewMode === 'map' && mySkillTags.length > 0)
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

          // Step 3 (map view only): radius filter — drop requests further than mapRadiusKm
          const radiusFiltered = (viewMode === 'map' && userLocation)
            ? tagFiltered.filter(r => {
                if (r.lat == null || r.lng == null) return true  // keep unlocated reqs
                return calcDistance(userLocation.lat, userLocation.lng, r.lat, r.lng) <= mapRadiusKm
              })
            : tagFiltered

          // What actually goes to the map vs the list
          const forMap  = radiusFiltered
          const forList = filtered

          return (
            <section className="mb-6">
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800">附近求服务</h3>
                  <p className="text-xs text-gray-400 mt-0.5">客户发布的服务需求，主动出击接单</p>
                </div>
                {/* List / Map toggle */}
                <div className="flex bg-gray-100 rounded-full p-0.5 flex-shrink-0">
                  <button
                    onClick={() => handleViewMode('list')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      viewMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    列表
                  </button>
                  <button
                    onClick={() => handleViewMode('map')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      viewMode === 'map' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    地图
                  </button>
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

              {/* Map view */}
              {viewMode === 'map' ? (
                <>
                  {/* Radius slider + skill-tag filter status */}
                  <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-3 shadow-sm flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-gray-500 flex-shrink-0">距离范围</span>
                    <div className="flex gap-1 flex-shrink-0">
                      {[3, 5, 10].map(km => (
                        <button key={km}
                          onClick={() => handleMapRadius(km)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                            mapRadiusKm === km
                              ? 'bg-primary-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {km} km
                        </button>
                      ))}
                    </div>
                    {mySkillTags.length > 0 && (
                      <span className="text-[11px] text-gray-400 flex-1 truncate">
                        已按你的标签过滤：{mySkillTags.slice(0, 3).join('、')}{mySkillTags.length > 3 ? '…' : ''}
                      </span>
                    )}
                  </div>
                  <Suspense fallback={<div className="h-80 rounded-2xl bg-gray-100 animate-pulse" />}>
                    <ServiceMap
                      services={[]}
                      requests={forMap}
                      count={forMap.length}
                      requestsOnly
                    />
                  </Suspense>
                  {mySkillTags.length === 0 && (
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      💡 在「我的主页 → 业务标签」里设置标签，地图就会按你能接的单类型自动过滤
                    </p>
                  )}
                </>
              ) : (
                /* List view */
                forList.length === 0 ? (
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
                    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3">
                      {forList.map((req) => (
                        <div key={req.id} className="break-inside-avoid mb-3">
                          <ServiceRequestCard request={req} layout="masonry" />
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}
            </section>
          )
        })()}

      </div>
      </div>
    </div>
  )
}
