// ─── Fullscreen Map Page ──────────────────────────────────────────────────────
// Route: /map  — Google Maps-style fullscreen experience with top search bar
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search, Navigation, X, RefreshCw } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { useGeolocation, useUpdateLocation, LOCATION_STALE_MS } from '../../hooks/useGeolocation'
import { supabase } from '../../lib/supabase'
import GoogleMapCanvas, { type GoogleMapCanvasHandle, type GoogleMapPoint } from '../../components/ServiceMap/GoogleMapCanvas'
import type { Service, OnlineProvider } from '../../types'
import { buildServiceInfo, buildDemandInfo, buildOnlineProviderInfo } from '../../lib/mapInfoWindows'

function hasCoordinates(service: Service): service is Service & {
  location: { lat: number; lng: number; address: string; city: string; area?: string }
} {
  return service.location.lat != null && service.location.lng != null
}

export default function MapPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<'services' | 'requests'>(
    searchParams.get('type') === 'requests' ? 'requests' : 'services'
  )
  const requestsMode = mode === 'requests'
  const [searchOpen, setSearchOpen] = useState(false)
  const services = useAppStore((s) => s.services)
  const serviceRequests = useAppStore((s) => s.serviceRequests)
  const userLocation = useAppStore((s) => s.userLocation)
  const user = useAuthStore((s) => s.user)
  const requestLocation = useGeolocation()
  const { locating, updateLocation } = useUpdateLocation()
  const mapRef = useRef<GoogleMapCanvasHandle>(null)
  const [search, setSearch] = useState('')
  const [onlineProviders, setOnlineProviders] = useState<OnlineProvider[]>([])

  // Auto-request location on mount; refresh if the cached fix is stale (>10 min).
  useEffect(() => {
    requestLocation({ maxAgeMs: LOCATION_STALE_MS })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (requestsMode) return
    let cancelled = false
    supabase.from('users')
      .select('id, name, avatar_url, online_lat, online_lng, skill_tags')
      .eq('is_online', true)
      .not('online_lat', 'is', null)
      .not('online_lng', 'is', null)
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.warn('[MapPage] online providers fetch failed:', error.message); return }
        if (data) setOnlineProviders(data as OnlineProvider[])
      })
    return () => { cancelled = true }
  }, [requestsMode])

  // Provider mode: also show service requests as orange pins
  const isProvider = !!user && services.some((s) => s.provider.id === user.id)

  const kw = search.trim().toLowerCase()
  const matches = (text: string | null | undefined) => !kw || (text ?? '').toLowerCase().includes(kw)

  const mapped = useMemo(
    () => services.filter(hasCoordinates).filter((s) =>
      matches(s.title) || matches(s.description) || matches(s.location.area) || matches(s.location.address)
    ),
    [services, kw]
  )

  const servicePoints = useMemo<GoogleMapPoint[]>(() => {
    if (requestsMode) return []
    return mapped.map((service) => ({
      id: service.id,
      lat: service.location.lat!,
      lng: service.location.lng!,
      title: service.title,
      promoted: service.isPromoted,
      infoContent: buildServiceInfo(
        service,
        () => navigate(`/service/${service.id}`),
        () => navigate(`/provider/${service.provider.id}`),
      ),
    }))
  }, [mapped, navigate, requestsMode])

  const requestPoints = useMemo<GoogleMapPoint[]>(() => {
    // In requestsMode mode, show all customer requests (don't gate by isProvider)
    if (!requestsMode && !isProvider) return []
    return serviceRequests
      .filter((r) => r.lat != null && r.lng != null)
      .filter((r) => matches(r.title) || matches(r.description) || matches(r.area))
      .map((r) => ({
        id: `req-${r.id}`,
        lat: r.lat!,
        lng: r.lng!,
        title: r.title,
        promoted: false,
        demandPin: true,
        infoContent: buildDemandInfo(r, () => navigate(`/requests/${r.id}`)),
      } as GoogleMapPoint))
  }, [serviceRequests, isProvider, navigate, kw, requestsMode])

  const onlinePoints = useMemo<GoogleMapPoint[]>(() =>
    onlineProviders
      .filter((p) => matches(p.name) || p.skill_tags.some(t => matches(t)))
      .map((p) => ({
        id: `online-${p.id}`,
        lat: p.online_lat,
        lng: p.online_lng,
        title: p.name,
        promoted: false,
        onlineProv: true,
        infoContent: buildOnlineProviderInfo(p, () => navigate(`/provider/${p.id}`)),
      } as GoogleMapPoint))
  , [onlineProviders, navigate, kw])

  const points = useMemo(
    () => [...servicePoints, ...requestPoints, ...onlinePoints],
    [servicePoints, requestPoints, onlinePoints]
  )

  const center = userLocation ?? { lat: 43.7, lng: -79.42 }

  function handleLocate() {
    if (userLocation) mapRef.current?.panToUser()
    else requestLocation()
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">

      {/* Top bar — back + 找服务/找需求 切换 + 小搜索键 */}
      <div className="flex-shrink-0 bg-white shadow-md z-10">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full hover:bg-gray-100 active:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="返回"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>

          {/* 找服务 / 找需求 切换 */}
          <div className="flex-1 flex justify-center">
            <div className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5 text-sm">
              <button
                onClick={() => setMode('services')}
                className={`px-4 py-1.5 rounded-full font-semibold transition-colors ${
                  mode === 'services' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                找服务
              </button>
              <button
                onClick={() => setMode('requests')}
                className={`px-4 py-1.5 rounded-full font-semibold transition-colors ${
                  mode === 'requests' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                找需求
              </button>
            </div>
          </div>

          {/* 小搜索键（右上角）— 点击展开搜索框 */}
          <button
            onClick={() => setSearchOpen((o) => !o)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0
              ${searchOpen ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-100 text-gray-600'}`}
            aria-label="搜索"
          >
            <Search size={20} />
          </button>
        </div>

        {/* 可展开搜索框 */}
        {searchOpen && (
          <div className="px-3 pb-2.5">
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5">
              <Search size={16} className="text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={requestsMode ? '搜索需求、关键词、地点…' : '搜索服务、商家、地点…'}
                className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400 min-w-0"
              />
              {search ? (
                <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600" aria-label="清空搜索">
                  <X size={16} />
                </button>
              ) : (
                <button onClick={() => setSearchOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="收起搜索">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map fills remaining height */}
      <div className="flex-1 relative">
        <GoogleMapCanvas
          ref={mapRef}
          center={center}
          zoom={userLocation ? 13 : 11}
          points={points}
          userLocation={userLocation}
        />

        {/* Locate button — bottom LEFT（右下留给 4 个操作按钮 FABGroup）*/}
        <button
          onClick={handleLocate}
          className={`absolute bottom-6 left-4 z-30 w-12 h-12 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all
            ${userLocation ? 'bg-white hover:bg-gray-50' : 'bg-primary-600 hover:bg-primary-700'}`}
          aria-label="定位到我的位置"
        >
          <Navigation size={20} className={userLocation ? 'text-primary-600' : 'text-white'} fill={userLocation ? 'currentColor' : 'white'} />
        </button>

        {/* Update-my-location — fresh GPS read, throttled to once / 5 min */}
        <button
          onClick={() => updateLocation(() => mapRef.current?.panToUser())}
          disabled={locating}
          title="更新我的位置（最多每 5 分钟一次）"
          className="absolute bottom-20 left-4 z-30 h-9 pl-2.5 pr-3 rounded-full shadow-lg bg-white hover:bg-gray-50
                     flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-70 text-xs font-medium text-gray-700"
        >
          <RefreshCw size={14} className={locating ? 'animate-spin' : ''} />
          {locating ? '定位中' : '更新位置'}
        </button>

        {/* Result count + legend */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-full px-3 py-1.5 shadow-md text-xs font-semibold text-gray-700">
          {kw ? `找到 ${points.length} 项` : `${points.length} ${requestsMode ? '条需求' : '项服务'}`}
        </div>

        {/* No results state */}
        {kw && points.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-lg p-6 text-center">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">没有找到「{search}」</p>
            <p className="text-xs text-gray-400">换个关键词试试</p>
          </div>
        )}
      </div>
    </div>
  )
}
