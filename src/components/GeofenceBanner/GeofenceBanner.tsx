import { useEffect, useState } from 'react'
import { MapPin, X } from 'lucide-react'

// Toronto centre coordinates
const TOR_LAT = 43.6532
const TOR_LNG = -79.3832
// ~150 km radius covers all of GTA + Hamilton + Barrie
const MAX_KM = 150

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const SESSION_KEY = 'tcs_geofence_dismissed'

export default function GeofenceBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const km = haversineKm(pos.coords.latitude, pos.coords.longitude, TOR_LAT, TOR_LNG)
        if (km > MAX_KM) setShow(true)
      },
      () => { /* permission denied or error — do nothing */ },
      { timeout: 8000, maximumAge: 300_000 },
    )
  }, [])

  if (!show) return null

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setShow(false)
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm
                    bg-amber-50 border border-amber-200 rounded-2xl shadow-lg px-4 py-3
                    flex items-start gap-3">
      <MapPin size={18} className="text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">当前位置不在大多伦多服务区</p>
        <p className="text-xs text-amber-600 mt-0.5">
          本平台目前仅服务大多伦多地区（GTA）。部分功能可能无法使用。
        </p>
      </div>
      <button onClick={dismiss} className="text-amber-400 hover:text-amber-600 shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
