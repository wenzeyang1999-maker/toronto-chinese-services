// ─── ServiceMap ────────────────────────────────────────────────────────────────
// Renders a Google map with service markers and the user's current location.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Service } from '../../types'
import { useAppStore } from '../../store/appStore'
import GoogleMapCanvas, { type GoogleMapPoint } from './GoogleMapCanvas'

interface Props {
  services: Service[]
  count?: number  // nearby service count used to size the map
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

function mapHeight(count: number): number {
  if (count === 0)        return 320
  if (count <= 5)         return 380
  if (count <= 15)        return 480
  if (count <= 30)        return 560
  return 640
}

export default function ServiceMap({ services, count }: Props) {
  const navigate = useNavigate()
  const userLocation = useAppStore((s) => s.userLocation)
  const mapped = useMemo(() => services.filter(hasCoordinates), [services])

  const center = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : { lat: 43.7, lng: -79.42 }

  const height = mapHeight(count ?? mapped.length)

  const points = useMemo<GoogleMapPoint[]>(() => mapped.map((service) => ({
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

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm transition-all duration-500" style={{ height, minHeight: 320 }}>
      {mapped.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
          <span className="text-4xl mb-2">📍</span>
          <p className="text-sm">暂无商家填写位置信息</p>
          <p className="text-xs mt-1">发布服务时填写位置后即可显示在地图上</p>
        </div>
      )}

      <GoogleMapCanvas
        center={center}
        zoom={userLocation ? 13 : 11}
        points={points}
        userLocation={userLocation}
      />

      <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5
                      border border-gray-200 shadow-sm flex items-center gap-3 text-xs text-gray-600">
        {userLocation && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm inline-block" />
            我的位置
          </span>
        )}
        {mapped.length > 0 && (
          <span>共 <strong>{mapped.length}</strong> 家</span>
        )}
        {mapped.some((s) => s.isPromoted) && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            推广
          </span>
        )}
      </div>
    </div>
  )
}
