// ─── ServiceMap ────────────────────────────────────────────────────────────────
// Renders a Leaflet map with markers for services that have lat/lng.
// Shows user's current location as a Google Maps-style blue dot with heading arrow.
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import { useNavigate } from 'react-router-dom'
import type { Service } from '../../types'
import { useAppStore } from '../../store/appStore'
// Fix default marker icons broken by Vite asset handling
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

// Google Maps-style "my location" icon — blue dot with white border + direction arrow on top
const myLocationIcon = L.divIcon({
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `
    <div style="position:relative;width:24px;height:24px;">
      <!-- outer pulse ring -->
      <div style="
        position:absolute;inset:-8px;
        border-radius:50%;
        background:rgba(66,133,244,0.18);
        animation:pulse-ring 2s ease-out infinite;
      "></div>
      <!-- white border -->
      <div style="
        position:absolute;inset:0;
        border-radius:50%;
        background:#fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
      "></div>
      <!-- blue fill -->
      <div style="
        position:absolute;inset:3px;
        border-radius:50%;
        background:#4285F4;
      "></div>
      <!-- direction arrow (triangle pointing up) -->
      <div style="
        position:absolute;
        top:-10px;left:50%;
        transform:translateX(-50%);
        width:0;height:0;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-bottom:10px solid #4285F4;
        filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));
      "></div>
    </div>
    <style>
      @keyframes pulse-ring {
        0%   { transform:scale(1);   opacity:0.7; }
        100% { transform:scale(2.2); opacity:0;   }
      }
    </style>
  `,
})

// Centers map on user location when it becomes available, otherwise fits service bounds
function MapController({ services, userLocation }: {
  services: Service[]
  userLocation: { lat: number; lng: number } | null
}) {
  const map = useMap()

  useEffect(() => {
    if (userLocation) {
      // Center on user with enough zoom to see nearby services
      map.setView([userLocation.lat, userLocation.lng], 13, { animate: true })
      return
    }
    // Fallback: fit to service markers
    const points = services
      .filter(hasCoordinates)
      .map((s) => [s.location.lat, s.location.lng] as [number, number])
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 13)
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
    }
  }, [userLocation, services, map])

  return null
}

interface Props {
  services: Service[]
}

function hasCoordinates(service: Service): service is Service & { location: { lat: number; lng: number; address: string; city: string; area?: string } } {
  return service.location.lat != null && service.location.lng != null
}

export default function ServiceMap({ services }: Props) {
  const navigate     = useNavigate()
  const userLocation = useAppStore((s) => s.userLocation)

  const mapped = services.filter(hasCoordinates)

  // Default center: user location if available, else downtown Toronto
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [43.7, -79.42]

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
        center={center}
        zoom={userLocation ? 13 : 11}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController services={mapped} userLocation={userLocation} />

        {/* User location: accuracy circle + blue dot with arrow */}
        {userLocation && (
          <>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={300}
              pathOptions={{ color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.08, weight: 1 }}
            />
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={myLocationIcon}
              zIndexOffset={1000}
            >
              <Popup>
                <p className="text-xs font-semibold text-gray-700">📍 您的当前位置</p>
              </Popup>
            </Marker>
          </>
        )}

        {/* Service markers */}
        {mapped.map((svc) => (
          <Marker
            key={svc.id}
            position={[svc.location.lat, svc.location.lng]}
            icon={svc.isPromoted ? promotedIcon : new L.Icon.Default()}
          >
            <Popup maxWidth={220} className="service-map-popup">
              <div className="p-1">
                {svc.images?.[0] && (
                  <img src={svc.images[0]} alt={svc.title} className="w-full h-24 object-cover rounded-lg mb-2" />
                )}
                <p className="font-semibold text-gray-900 text-sm leading-tight mb-0.5">{svc.title}</p>
                <p className="text-xs text-gray-500 mb-1">
                  {svc.provider.name}
                  {svc.provider.rating > 0 && (
                    <span className="ml-1.5 text-amber-500">★ {svc.provider.rating.toFixed(1)}</span>
                  )}
                </p>
                <p className="text-xs font-medium text-primary-600 mb-2">
                  {svc.priceType === 'hourly' ? `$${svc.price}/时` :
                   svc.priceType === 'fixed'  ? `$${svc.price}起`  : '面议'}
                </p>
                {svc.location.address && (
                  <p className="text-xs text-gray-400 mb-2 truncate">📍 {svc.location.address}</p>
                )}
                <button
                  onClick={() => navigate(`/service/${svc.id}`)}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
                >
                  查看详情
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
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
