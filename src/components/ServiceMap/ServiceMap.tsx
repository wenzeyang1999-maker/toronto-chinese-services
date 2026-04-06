// ─── ServiceMap ────────────────────────────────────────────────────────────────
// Renders a Leaflet map with markers for services that have lat/lng.
// Clicking a marker shows a popup with basic info + link to detail page.
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useNavigate } from 'react-router-dom'
import type { Service } from '../../types'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons broken by Webpack/Vite asset handling
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom red marker for promoted services
const promotedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Auto-fit map bounds to visible markers
function FitBounds({ services }: { services: Service[] }) {
  const map = useMap()
  useEffect(() => {
    const points = services
      .filter((s) => s.location?.lat && s.location?.lng)
      .map((s) => [s.location.lat, s.location.lng] as [number, number])
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 13)
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
    }
  }, [services, map])
  return null
}

interface Props {
  services: Service[]
}

export default function ServiceMap({ services }: Props) {
  const navigate = useNavigate()

  const mapped = services.filter((s) => s.location?.lat && s.location?.lng)

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '60vh', minHeight: 320 }}>
      {mapped.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
          <span className="text-4xl mb-2">📍</span>
          <p className="text-sm">暂无商家填写位置信息</p>
          <p className="text-xs mt-1">发布服务时填写位置后即可显示在地图上</p>
        </div>
      )}
      <MapContainer
        center={[43.7, -79.42]}
        zoom={11}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds services={mapped} />
        {mapped.map((svc) => (
          <Marker
            key={svc.id}
            position={[svc.location.lat, svc.location.lng]}
            icon={svc.isPromoted ? promotedIcon : new L.Icon.Default()}
          >
            <Popup maxWidth={220} className="service-map-popup">
              <div className="p-1">
                {/* Image */}
                {svc.images?.[0] && (
                  <img
                    src={svc.images[0]}
                    alt={svc.title}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                )}
                {/* Title */}
                <p className="font-semibold text-gray-900 text-sm leading-tight mb-0.5">{svc.title}</p>
                {/* Provider */}
                <p className="text-xs text-gray-500 mb-1">
                  {svc.provider.name}
                  {svc.provider.rating > 0 && (
                    <span className="ml-1.5 text-amber-500">★ {svc.provider.rating.toFixed(1)}</span>
                  )}
                </p>
                {/* Price */}
                <p className="text-xs font-medium text-primary-600 mb-2">
                  {svc.priceType === 'hourly' ? `$${svc.price}/时` :
                   svc.priceType === 'fixed'  ? `$${svc.price}起`  : '面议'}
                </p>
                {/* Location text */}
                {svc.location.address && (
                  <p className="text-xs text-gray-400 mb-2 truncate">📍 {svc.location.address}</p>
                )}
                <button
                  onClick={() => navigate(`/service/${svc.id}`)}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold
                             py-1.5 rounded-lg transition-colors"
                >
                  查看详情
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {/* Legend */}
      {mapped.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5
                        border border-gray-200 shadow-sm flex items-center gap-3 text-xs text-gray-600">
          <span>共 <strong>{mapped.length}</strong> 家有位置</span>
          {mapped.some((s) => s.isPromoted) && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              推广商家
            </span>
          )}
        </div>
      )}
    </div>
  )
}
