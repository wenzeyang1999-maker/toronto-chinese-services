// ─── ServiceMap ────────────────────────────────────────────────────────────────
// Renders a Google map with service markers and the user's current location.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation, Maximize2, MapPin, RefreshCw } from 'lucide-react'
import type { Service, ServiceRequest, OnlineProvider } from '../../types'
import { useAppStore } from '../../store/appStore'
import { useGeolocation, useUpdateLocation, LOCATION_STALE_MS } from '../../hooks/useGeolocation'
import { supabase } from '../../lib/supabase'
import GoogleMapCanvas, { type GoogleMapCanvasHandle, type GoogleMapPoint } from './GoogleMapCanvas'
import RadiusSlider from '../RadiusSlider/RadiusSlider'
import { buildServiceInfo, buildDemandInfo, buildOnlineProviderInfo } from '../../lib/mapInfoWindows'

interface Props {
  services: Service[]
  requests?: ServiceRequest[]  // optional demand pins
  count?: number
  /** Hide service pins + online providers, only show orange request pins. */
  requestsOnly?: boolean
  /** Free-text keyword. When set, filters online-provider pins by name + skill_tags. */
  keyword?: string
  /** Search radius in km — draws a circle around the user + fits the map to it. */
  radiusKm?: number
  /** When provided, shows a floating distance slider on the map. */
  onRadiusChange?: (km: number) => void
}

function hasCoordinates(service: Service): service is Service & {
  location: { lat: number; lng: number; address: string; city: string; area?: string }
} {
  return service.location.lat != null && service.location.lng != null
}

// Returns a CSS height string keyed to dvh (dynamic viewport) so iOS
// keyboard / URL-bar transitions don't visibly resize the map.
function mapHeight(count: number): string {
  if (count === 0)        return 'min(320px, 45dvh)'
  if (count <= 5)         return 'min(380px, 50dvh)'
  if (count <= 15)        return 'min(480px, 55dvh)'
  if (count <= 30)        return 'min(560px, 60dvh)'
  return 'min(640px, 65dvh)'
}

export default function ServiceMap({ services, requests = [], count, requestsOnly = false, keyword = '', radiusKm, onRadiusChange }: Props) {
  const navigate = useNavigate()
  const userLocation = useAppStore((s) => s.userLocation)
  const requestLocation = useGeolocation()
  const mapRef = useRef<GoogleMapCanvasHandle>(null)
  const mapped = useMemo(() => services.filter(hasCoordinates), [services])
  const [onlineProviders, setOnlineProviders] = useState<OnlineProvider[]>([])
  const { locating, updateLocation } = useUpdateLocation()

  // On mount, refresh location if we have none OR the cached fix is stale
  // (>10 min) — so the map reflects where you ARE now, not where you were hours
  // ago (e.g. you left home but the map still shows home). A fresh fix is silent
  // after the first grant; a failure keeps the last-known coords.
  useEffect(() => {
    requestLocation({ maxAgeMs: LOCATION_STALE_MS })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (requestsOnly) return  // Skip online providers fetch when only showing demand pins
    let cancelled = false
    supabase
      .from('users')
      .select('id, name, avatar_url, online_lat, online_lng, skill_tags')
      .eq('is_online', true)
      .not('online_lat', 'is', null)
      .not('online_lng', 'is', null)
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.warn('[ServiceMap] online providers fetch failed:', error.message); return }
        if (data) setOnlineProviders(data as OnlineProvider[])
      })
    return () => { cancelled = true }
  }, [requestsOnly])

  function handleLocate() {
    if (userLocation) {
      mapRef.current?.panToUser()
    } else {
      requestLocation()
    }
  }

  const center = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : { lat: 43.7, lng: -79.42 }

  const height = mapHeight(count ?? mapped.length)

  // Service pins (blue/red for promoted) — skipped in requests-only mode
  const servicePoints = useMemo<GoogleMapPoint[]>(() => {
    if (requestsOnly) return []
    return mapped.map((service) => ({
      id: service.id,
      lat: service.location.lat,
      lng: service.location.lng,
      title: service.title,
      promoted: service.isPromoted,
      infoContent: buildServiceInfo(
        service,
        () => navigate(`/service/${service.id}`),
        () => navigate(`/provider/${service.provider.id}`),
      ),
    }))
  }, [mapped, navigate, requestsOnly])

  // Demand pins (orange) from service requests with coordinates
  const requestPoints = useMemo<GoogleMapPoint[]>(() =>
    requests
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => ({
        id: `req-${r.id}`,
        lat: r.lat!,
        lng: r.lng!,
        title: r.title,
        promoted: false,
        demandPin: true,
        infoContent: buildDemandInfo(r, () => navigate(`/requests/${r.id}`)),
      } as GoogleMapPoint & { demandPin?: boolean }))
  , [requests, navigate])

  // Online provider pins (green) — broadcast real-time locations
  const onlinePoints = useMemo<GoogleMapPoint[]>(() => {
    const kw = keyword.trim().toLowerCase()
    const matches = (p: OnlineProvider) => {
      if (!kw) return true
      if (p.name.toLowerCase().includes(kw)) return true
      return p.skill_tags.some(t => t.toLowerCase().includes(kw))
    }
    return onlineProviders.filter(matches).map((p) => ({
      id: `online-${p.id}`,
      lat: p.online_lat,
      lng: p.online_lng,
      title: p.name,
      promoted: false,
      onlineProv: true,
      infoContent: buildOnlineProviderInfo(p, () => navigate(`/provider/${p.id}`)),
    } as GoogleMapPoint & { onlineProv?: boolean }))
  }, [onlineProviders, navigate, keyword])

  const points = useMemo(() => [...servicePoints, ...requestPoints, ...onlinePoints], [servicePoints, requestPoints, onlinePoints])

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm transition-all duration-500" style={{ height, minHeight: '320px' }}>
      {points.length === 0 && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-md px-4 py-2.5 text-center pointer-events-none">
          <p className="text-xs font-medium text-gray-600">{requestsOnly ? '附近暂无标记位置的需求' : '暂无商家填写位置信息'}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{requestsOnly ? '客户发布需求时勾选位置即可显示' : '发布服务时填写位置后即可显示在地图上'}</p>
        </div>
      )}

      <GoogleMapCanvas
        ref={mapRef}
        center={center}
        zoom={userLocation ? 13 : 11}
        points={points}
        userLocation={userLocation}
        radiusKm={radiusKm}
      />

      {/* Distance slider — floats on the map (Google Maps style) */}
      {onRadiusChange && (
        <div className="absolute top-3 left-3 z-[400]">
          {userLocation ? (
            <RadiusSlider value={radiusKm ?? 5} onChange={onRadiusChange} />
          ) : (
            <button
              onClick={() => requestLocation()}
              className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-md
                         border border-gray-200 px-3 py-2 text-xs font-semibold text-primary-600
                         active:scale-95 transition-all"
            >
              <MapPin size={13} />
              开启定位筛选距离
            </button>
          )}
        </div>
      )}

      {/* Locate-me button — Google Maps style */}
      <button
        onClick={handleLocate}
        title="定位到我的位置"
        className={`absolute top-3 right-3 z-[400] w-10 h-10 rounded-full shadow-md
                   flex items-center justify-center active:scale-95 transition-all
                   ${userLocation
                     ? 'bg-red-500 hover:bg-red-600'
                     : 'bg-primary-600 hover:bg-primary-700'}`}
      >
        <Navigation size={18} className="text-white" fill="white" />
      </button>

      {/* Update-my-location — forces a fresh GPS read (throttled to once / 5 min) */}
      <button
        onClick={() => updateLocation(() => mapRef.current?.panToUser())}
        disabled={locating}
        title="更新我的位置（最多每 5 分钟一次）"
        className="absolute top-14 right-3 z-[400] h-8 pl-2 pr-2.5 rounded-full shadow-md
                   bg-white hover:bg-gray-50 flex items-center gap-1 active:scale-95 transition-all
                   disabled:opacity-70 text-xs font-medium text-gray-700"
      >
        <RefreshCw size={13} className={locating ? 'animate-spin' : ''} />
        {locating ? '定位中' : '更新位置'}
      </button>

      {/* Fullscreen button — opens dedicated /map page */}
      <button
        onClick={() => navigate(requestsOnly ? '/map?type=requests' : '/map')}
        title="全屏地图"
        className="absolute top-3 right-14 z-[400] w-10 h-10 rounded-full shadow-md bg-white hover:bg-gray-50
                   flex items-center justify-center active:scale-95 transition-all"
      >
        <Maximize2 size={16} className="text-gray-700" />
      </button>

      <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5
                      border border-gray-200 shadow-sm flex items-center gap-3 text-xs text-gray-600">
        {userLocation && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm inline-block" />
            我的位置
          </span>
        )}
        {!requestsOnly && mapped.length > 0 && (
          <span>共 <strong>{mapped.length}</strong> 项服务</span>
        )}
        {requestsOnly && requestPoints.length > 0 && (
          <span>共 <strong>{requestPoints.length}</strong> 条需求</span>
        )}
        {mapped.some((s) => s.isPromoted) && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            推广
          </span>
        )}
        {requestPoints.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            求服务 {requestPoints.length}
          </span>
        )}
        {onlinePoints.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            在线服务商 {onlinePoints.length}
          </span>
        )}
      </div>
    </div>
  )
}
