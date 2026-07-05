// ─── PropertyMap ──────────────────────────────────────────────────────────────
// Google map view for the real-estate list. A thin wrapper around
// GoogleMapCanvas (same primitive ServiceMap uses) that plots properties which
// have coordinates, plus the user's location + a locate-me button.
import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useGeolocation } from '../../hooks/useGeolocation'
import GoogleMapCanvas, { type GoogleMapCanvasHandle, type GoogleMapPoint } from '../ServiceMap/GoogleMapCanvas'
import { buildPropertyInfo } from '../../lib/mapInfoWindows'
import { getPriceLabel, getBedroomLabel, type Property } from '../../pages/RealEstate/types'

interface Props {
  properties: Property[]
}

function metaOf(p: Property): string {
  const parts: string[] = []
  if (p.bedrooms != null) parts.push(getBedroomLabel(p.bedrooms))
  if (p.bathrooms != null) parts.push(`${p.bathrooms}卫`)
  if (p.sqft != null && p.sqft > 0) parts.push(`${p.sqft}呎`)
  if (p.area && p.area.length > 0) parts.push(p.area[0])
  return parts.filter(Boolean).join(' · ')
}

export default function PropertyMap({ properties }: Props) {
  const navigate = useNavigate()
  const userLocation = useAppStore((s) => s.userLocation)
  const requestLocation = useGeolocation()
  const mapRef = useRef<GoogleMapCanvasHandle>(null)

  const mapped = useMemo(
    () => properties.filter((p) => p.lat != null && p.lng != null),
    [properties],
  )

  const points = useMemo<GoogleMapPoint[]>(() =>
    mapped.map((p) => ({
      id: p.id,
      lat: p.lat!,
      lng: p.lng!,
      title: p.title,
      infoContent: buildPropertyInfo(
        p,
        getPriceLabel(p),
        metaOf(p),
        () => navigate(`/realestate/${p.id}`),
      ),
    }))
  , [mapped, navigate])

  const center = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : { lat: 43.7, lng: -79.42 }

  function handleLocate() {
    if (userLocation) mapRef.current?.panToUser()
    else requestLocation()
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
         style={{ height: 'min(640px, 68dvh)', minHeight: 320 }}>
      {points.length === 0 && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-md px-4 py-2.5 text-center pointer-events-none">
          <p className="text-xs font-medium text-gray-600">当前筛选下暂无标注位置的房源</p>
          <p className="text-[11px] text-gray-400 mt-0.5">发布房源时填写地址即可显示在地图上</p>
        </div>
      )}

      <GoogleMapCanvas
        ref={mapRef}
        center={center}
        zoom={userLocation ? 12 : 11}
        points={points}
        userLocation={userLocation}
      />

      <button
        onClick={handleLocate}
        title="定位到我的位置"
        className={`absolute top-3 right-3 z-[400] w-10 h-10 rounded-full shadow-md
                   flex items-center justify-center active:scale-95 transition-all
                   ${userLocation ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-600 hover:bg-primary-700'}`}
      >
        <Navigation size={18} className="text-white" fill="white" />
      </button>

      <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5
                      border border-gray-200 shadow-sm flex items-center gap-3 text-xs text-gray-600">
        {userLocation && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm inline-block" />
            我的位置
          </span>
        )}
        <span>共 <strong>{mapped.length}</strong> 个房源</span>
      </div>
    </div>
  )
}
