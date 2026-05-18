// ─── Fullscreen Map Page ──────────────────────────────────────────────────────
// Route: /map  — Google Maps-style fullscreen experience with top search bar
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Navigation, X } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { useGeolocation } from '../../hooks/useGeolocation'
import { supabase } from '../../lib/supabase'
import GoogleMapCanvas, { type GoogleMapCanvasHandle, type GoogleMapPoint } from '../../components/ServiceMap/GoogleMapCanvas'
import type { Service } from '../../types'

interface OnlineProvider {
  id: string
  name: string
  avatar_url: string | null
  online_lat: number
  online_lng: number
  skill_tags: string[]
}

function hasCoordinates(service: Service): service is Service & {
  location: { lat: number; lng: number; address: string; city: string; area?: string }
} {
  return service.location.lat != null && service.location.lng != null
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
    service.priceType === 'fixed'  ? `$${service.price}起` : '面议'
  wrapper.appendChild(price)
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

export default function MapPage() {
  const navigate = useNavigate()
  const services = useAppStore((s) => s.services)
  const serviceRequests = useAppStore((s) => s.serviceRequests)
  const userLocation = useAppStore((s) => s.userLocation)
  const user = useAuthStore((s) => s.user)
  const requestLocation = useGeolocation()
  const mapRef = useRef<GoogleMapCanvasHandle>(null)
  const [search, setSearch] = useState('')
  const [onlineProviders, setOnlineProviders] = useState<OnlineProvider[]>([])

  // Auto-request location on mount
  useEffect(() => {
    if (!userLocation) requestLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    supabase.from('users')
      .select('id, name, avatar_url, online_lat, online_lng, skill_tags')
      .eq('is_online', true)
      .not('online_lat', 'is', null)
      .not('online_lng', 'is', null)
      .limit(50)
      .then(({ data }) => { if (data) setOnlineProviders(data as OnlineProvider[]) })
  }, [])

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

  const servicePoints = useMemo<GoogleMapPoint[]>(() => mapped.map((service) => ({
    id: service.id,
    lat: service.location.lat!,
    lng: service.location.lng!,
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

  const requestPoints = useMemo<GoogleMapPoint[]>(() => {
    if (!isProvider) return []
    return serviceRequests
      .filter((r) => r.lat != null && r.lng != null)
      .filter((r) => matches(r.title) || matches(r.description) || matches(r.area))
      .map((r) => {
        const el = document.createElement('div')
        el.innerHTML = `
          <div style="padding:10px 14px;min-width:180px">
            <div style="font-size:11px;font-weight:700;color:#ea580c;margin-bottom:4px">🔍 求服务</div>
            <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:6px">${r.title}</div>
            ${r.budget ? `<div style="font-size:11px;color:#16a34a;margin-bottom:4px">💰 ${r.budget}</div>` : ''}
            <div style="font-size:11px;color:#888">还剩 ${r.daysLeft} 天</div>
            <button data-req-id="${r.id}"
              style="margin-top:8px;width:100%;background:#ea580c;color:#fff;border:none;border-radius:8px;padding:6px 0;font-size:12px;font-weight:600;cursor:pointer">
              查看详情
            </button>
          </div>`
        return {
          id: `req-${r.id}`,
          lat: r.lat!,
          lng: r.lng!,
          title: r.title,
          promoted: false,
          demandPin: true,
          infoContent: el,
          onInfoReady: (content) => {
            const btn = content.querySelector<HTMLButtonElement>('[data-req-id]')
            if (btn) btn.onclick = () => navigate(`/requests/${r.id}`)
          },
        } as GoogleMapPoint
      })
  }, [serviceRequests, isProvider, navigate, kw])

  const onlinePoints = useMemo<GoogleMapPoint[]>(() =>
    onlineProviders
      .filter((p) => matches(p.name) || p.skill_tags.some(t => matches(t)))
      .map((p) => {
        const el = document.createElement('div')
        el.innerHTML = `
          <div style="padding:10px 14px;min-width:160px">
            <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:4px">🟢 在线接单</div>
            <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:4px">${p.name}</div>
            ${p.skill_tags.length > 0 ? `<div style="font-size:11px;color:#6b7280;margin-bottom:6px">${p.skill_tags.slice(0, 3).join(' · ')}</div>` : ''}
            <button data-provider-id="${p.id}"
              style="width:100%;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:6px 0;font-size:12px;font-weight:600;cursor:pointer">
              查看主页
            </button>
          </div>`
        return {
          id: `online-${p.id}`,
          lat: p.online_lat,
          lng: p.online_lng,
          title: p.name,
          promoted: false,
          onlineProv: true,
          infoContent: el,
          onInfoReady: (content) => {
            const btn = content.querySelector<HTMLButtonElement>('[data-provider-id]')
            if (btn) btn.onclick = () => navigate(`/provider/${p.id}`)
          },
        } as GoogleMapPoint
      })
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

      {/* Top bar — search + back */}
      <div className="flex-shrink-0 bg-white shadow-md z-10">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full hover:bg-gray-100 active:bg-gray-200 flex items-center justify-center transition-colors"
            aria-label="返回"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5">
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索服务、商家、地点…"
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400 min-w-0"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-gray-400 hover:text-gray-600"
                aria-label="清空搜索"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
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

        {/* Locate button — bottom right Google Maps style */}
        <button
          onClick={handleLocate}
          className={`absolute bottom-6 right-4 z-30 w-12 h-12 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all
            ${userLocation ? 'bg-white hover:bg-gray-50' : 'bg-primary-600 hover:bg-primary-700'}`}
          aria-label="定位到我的位置"
        >
          <Navigation size={20} className={userLocation ? 'text-primary-600' : 'text-white'} fill={userLocation ? 'currentColor' : 'white'} />
        </button>

        {/* Result count + legend */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-full px-3 py-1.5 shadow-md text-xs font-semibold text-gray-700">
          {kw ? `找到 ${points.length} 项` : `${points.length} 项服务`}
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
