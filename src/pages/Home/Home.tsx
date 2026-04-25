import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import HeroBanner from '../../components/HeroBanner/HeroBanner'
import CategoryButtons from '../../components/CategoryButtons/CategoryButtons'
import InquiryModal from '../../components/InquiryModal/InquiryModal'
import SectionTabs, { type SectionTab } from '../../components/SectionTabs/SectionTabs'
import { useAppStore } from '../../store/appStore'
import { useGeolocation } from '../../hooks/useGeolocation'
import RecentCategories from '../../components/RecentCategories/RecentCategories'
import RecommendedServices from '../../components/RecommendedServices/RecommendedServices'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import HomeActionHero from './components/HomeActionHero'
import HomeServiceShelf from './components/HomeServiceShelf'

const ServiceMap = lazy(() => import('../../components/ServiceMap/ServiceMap'))

function calcDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
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
  const services     = useAppStore((s) => s.services)
  const setSearchFilters = useAppStore((s) => s.setSearchFilters)
  const userLocation = useAppStore((s) => s.userLocation)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [searchParams] = useSearchParams()
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SectionTab>('services')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const searchRef = useRef<HTMLDivElement>(null)

  // When clicking "找服务" tab, skip carousel and jump to search bar
  useEffect(() => {
    if (searchParams.get('from') !== 'tabs') return
    const scroll = () => {
      if (!searchRef.current) return
      const top = searchRef.current.getBoundingClientRect().top + window.scrollY - 110
      window.scrollTo({ top, behavior: 'smooth' })
    }
    // Small delay ensures the page has painted before scrolling
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

  // Map default view: nearby services only (within 25 km, max 40 markers)
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
      {/* Sticky: banner + section tabs */}
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

        {/* Recently browsed categories */}
        <RecentCategories />

        {/* Recent / nearby services */}
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
          mapContent={(filtered) => <ServiceMap services={filtered} count={nearbyForMap.length} />}
        />

        {/* Recommended for you */}
        <RecommendedServices />

        {/* Post CTA */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-5 mb-8 text-white">
          <h3 className="font-bold text-lg mb-1">有技能想接单？</h3>
          <p className="text-red-100 text-sm mb-3">免费发布您的服务，让附近有需要的客户找到您</p>
          <button
            onClick={() => user ? navigate('/post') : navigate('/login', { state: { from: '/post' } })}
            className="bg-white text-primary-600 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors active:scale-95"
          >
            立即发布服务 →
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
