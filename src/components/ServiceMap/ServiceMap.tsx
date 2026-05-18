// ─── ServiceMap ────────────────────────────────────────────────────────────────
// Renders a Google map with service markers and the user's current location.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation, Maximize2 } from 'lucide-react'
import type { Service, ServiceRequest } from '../../types'
import { useAppStore } from '../../store/appStore'
import { useGeolocation } from '../../hooks/useGeolocation'
import { supabase } from '../../lib/supabase'
import GoogleMapCanvas, { type GoogleMapCanvasHandle, type GoogleMapPoint } from './GoogleMapCanvas'

interface OnlineProvider {
  id: string
  name: string
  avatar_url: string | null
  online_lat: number
  online_lng: number
  skill_tags: string[]
}

interface Props {
  services: Service[]
  requests?: ServiceRequest[]  // optional demand pins
  count?: number
}

function hasCoordinates(service: Service): service is Service & {
  location: { lat: number; lng: number; address: string; city: string; area?: string }
} {
  return service.location.lat != null && service.location.lng != null
}

// ── Safe DOM builders (textContent only — no XSS) ────────────────────────────
function div(text: string, cssText: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = cssText
  el.textContent = text
  return el
}

function buildDemandInfo(r: ServiceRequest, onClick: () => void): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'padding:10px 14px;min-width:180px'
  wrapper.appendChild(div('🔍 求服务', 'font-size:11px;font-weight:700;color:#ea580c;margin-bottom:4px'))
  wrapper.appendChild(div(r.title, 'font-size:13px;font-weight:600;color:#111;margin-bottom:6px'))
  if (r.budget) wrapper.appendChild(div(`💰 ${r.budget}`, 'font-size:11px;color:#16a34a;margin-bottom:4px'))
  wrapper.appendChild(div(`还剩 ${r.daysLeft} 天`, 'font-size:11px;color:#888'))
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.style.cssText = 'margin-top:8px;width:100%;background:#ea580c;color:#fff;border:none;border-radius:8px;padding:6px 0;font-size:12px;font-weight:600;cursor:pointer'
  btn.textContent = '查看详情'
  btn.onclick = onClick
  wrapper.appendChild(btn)
  return wrapper
}

function buildOnlineProviderInfo(p: OnlineProvider, onClick: () => void): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'padding:10px 14px;min-width:160px'
  wrapper.appendChild(div('🟢 在线接单', 'font-size:11px;font-weight:700;color:#16a34a;margin-bottom:4px'))
  wrapper.appendChild(div(p.name, 'font-size:13px;font-weight:600;color:#111;margin-bottom:4px'))
  if (p.skill_tags.length > 0) {
    wrapper.appendChild(div(p.skill_tags.slice(0, 3).join(' · '), 'font-size:11px;color:#6b7280;margin-bottom:6px'))
  }
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.style.cssText = 'width:100%;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:6px 0;font-size:12px;font-weight:600;cursor:pointer'
  btn.textContent = '查看主页'
  btn.onclick = onClick
  wrapper.appendChild(btn)
  return wrapper
}

function createServiceInfoContent(service: Service): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'min-w-[190px] max-w-[220px] p-1'

  if (service.images?.[0]) {
    const img = document.createElement('img')
    img.src = service.images[0]
    img.alt = service.title
    img.className = 'w-full h-24 object-cover rounded-lg mb-2'
    wrapper.appendChild(img)
  }

  const title = document.createElement('p')
  title.className = 'font-semibold text-gray-900 text-sm leading-tight mb-0.5'
  title.textContent = service.title
  wrapper.appendChild(title)

  const provider = document.createElement('p')
  provider.className = 'text-xs text-gray-500 mb-1'
  provider.textContent = service.provider.rating > 0
    ? `${service.provider.name}  ★ ${service.provider.rating.toFixed(1)}`
    : service.provider.name
  wrapper.appendChild(provider)

  const price = document.createElement('p')
  price.className = 'text-xs font-medium text-primary-600 mb-2'
  price.textContent =
    service.priceType === 'hourly' ? `$${service.price}/时` :
    service.priceType === 'fixed' ? `$${service.price}起` :
    '面议'
  wrapper.appendChild(price)

  if (service.location.address) {
    const address = document.createElement('p')
    address.className = 'text-xs text-gray-400 mb-2 truncate'
    address.textContent = `📍 ${service.location.address}`
    wrapper.appendChild(address)
  }

  const row = document.createElement('div')
  row.className = 'flex gap-1.5'

  const detailBtn = document.createElement('button')
  detailBtn.type = 'button'
  detailBtn.dataset.serviceId = service.id
  detailBtn.className = 'flex-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors'
  detailBtn.textContent = '查看详情'
  row.appendChild(detailBtn)

  const providerBtn = document.createElement('button')
  providerBtn.type = 'button'
  providerBtn.dataset.providerId = service.provider.id
  providerBtn.className = 'flex-1 border border-primary-200 text-primary-600 hover:bg-primary-50 text-xs font-semibold py-2 rounded-lg transition-colors'
  providerBtn.textContent = '商家主页'
  row.appendChild(providerBtn)

  wrapper.appendChild(row)

  return wrapper
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

export default function ServiceMap({ services, requests = [], count }: Props) {
  const navigate = useNavigate()
  const userLocation = useAppStore((s) => s.userLocation)
  const requestLocation = useGeolocation()
  const mapRef = useRef<GoogleMapCanvasHandle>(null)
  const mapped = useMemo(() => services.filter(hasCoordinates), [services])
  const [onlineProviders, setOnlineProviders] = useState<OnlineProvider[]>([])

  useEffect(() => {
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
  }, [])

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

  // Service pins (blue/red for promoted)
  const servicePoints = useMemo<GoogleMapPoint[]>(() => mapped.map((service) => ({
    id: service.id,
    lat: service.location.lat,
    lng: service.location.lng,
    title: service.title,
    promoted: service.isPromoted,
    infoContent: createServiceInfoContent(service),
    onInfoReady: (content) => {
      const detailBtn = content.querySelector<HTMLButtonElement>('[data-service-id]')
      if (detailBtn) detailBtn.onclick = () => navigate(`/service/${service.id}`)
      const providerBtn = content.querySelector<HTMLButtonElement>('[data-provider-id]')
      if (providerBtn) providerBtn.onclick = () => navigate(`/provider/${service.provider.id}`)
    },
  })), [mapped, navigate])

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
  const onlinePoints = useMemo<GoogleMapPoint[]>(() =>
    onlineProviders.map((p) => ({
      id: `online-${p.id}`,
      lat: p.online_lat,
      lng: p.online_lng,
      title: p.name,
      promoted: false,
      onlineProv: true,
      infoContent: buildOnlineProviderInfo(p, () => navigate(`/provider/${p.id}`)),
    } as GoogleMapPoint & { onlineProv?: boolean }))
  , [onlineProviders, navigate])

  const points = useMemo(() => [...servicePoints, ...requestPoints, ...onlinePoints], [servicePoints, requestPoints, onlinePoints])

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm transition-all duration-500" style={{ height, minHeight: '320px' }}>
      {mapped.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
          <span className="text-4xl mb-2">📍</span>
          <p className="text-sm">暂无商家填写位置信息</p>
          <p className="text-xs mt-1">发布服务时填写位置后即可显示在地图上</p>
        </div>
      )}

      <GoogleMapCanvas
        ref={mapRef}
        center={center}
        zoom={userLocation ? 13 : 11}
        points={points}
        userLocation={userLocation}
      />

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

      {/* Fullscreen button — opens dedicated /map page */}
      <button
        onClick={() => navigate('/map')}
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
        {mapped.length > 0 && (
          <span>共 <strong>{mapped.length}</strong> 项服务</span>
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
