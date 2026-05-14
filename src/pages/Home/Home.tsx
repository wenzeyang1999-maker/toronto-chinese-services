import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import HeroBanner from '../../components/HeroBanner/HeroBanner'
import CategoryButtons from '../../components/CategoryButtons/CategoryButtons'
import InquiryModal from '../../components/InquiryModal/InquiryModal'
import SectionTabs, { type SectionTab } from '../../components/SectionTabs/SectionTabs'
import { useAppStore } from '../../store/appStore'
import { useGeolocation } from '../../hooks/useGeolocation'
import RecentCategories from '../../components/RecentCategories/RecentCategories'
import RecommendedServices from '../../components/RecommendedServices/RecommendedServices'
import ServiceRequestCard from '../../components/ServiceRequestCard/ServiceRequestCard'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import HomeActionHero from './components/HomeActionHero'
import HomeServiceShelf from './components/HomeServiceShelf'
import { PlusCircle, Search as SearchIcon } from 'lucide-react'

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
          <h3 className="text-base font-semibold text-gray-800 mb-1">探索服务</h3>
          <p className="text-xs text-gray-400 mb-3">选择你需要的板块，找服务·看房·论坛·二手一站搞定。</p>
          <CategoryButtons />
        </section>

        <RecentCategories />

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
              找客户
              {serviceRequests.length > 0 && (
                <span className="ml-1.5 text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">
                  {serviceRequests.length}
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
              mapContent={(filtered) => (
                <ServiceMap
                  services={filtered}
                  requests={isProvider ? serviceRequests : []}
                  count={nearbyForMap.length}
                />
              )}
            />
            <RecommendedServices />
          </>
        )}

        {/* ── Requests feed ────────────────────────────────────────────────── */}
        {feedMode === 'requests' && (() => {
          const kw = requestSearch.trim().toLowerCase()
          const filtered = kw
            ? serviceRequests.filter(r =>
                r.title.toLowerCase().includes(kw) ||
                (r.description ?? '').toLowerCase().includes(kw) ||
                r.category.toLowerCase().includes(kw) ||
                (r.area ?? '').toLowerCase().includes(kw)
              )
            : serviceRequests
          return (
            <section className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
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

              {filtered.length === 0 ? (
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
                      找到 <strong className="text-gray-700">{filtered.length}</strong> 条相关需求
                    </p>
                  )}
                  <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3">
                    {filtered.map((req) => (
                      <div key={req.id} className="break-inside-avoid mb-3">
                        <ServiceRequestCard request={req} layout="masonry" />
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
