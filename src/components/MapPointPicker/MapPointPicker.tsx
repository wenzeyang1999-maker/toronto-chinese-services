// ─── 地图选点(内测#11) ───────────────────────────────────────────────────────
// 全屏地图 + 固定中心红针:拖动地图让针对准目标 → 确认。取地图中心经纬度,
// 再用 Nominatim 反向地理编码补出可读地址(失败也不挡,回退坐标文本)。
// 复用 loadGoogleMaps(与 GoogleMapCanvas 同一套 key/加载器)。
import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2, X, Check } from 'lucide-react'
import { loadGoogleMaps } from '../../lib/googleMaps'
import { useAppStore } from '../../store/appStore'

export interface PickedPoint { lat: number; lng: number; address: string }

interface Props {
  initial?: { lat: number; lng: number } | null
  onCancel: () => void
  onConfirm: (loc: PickedPoint) => void
}

export default function MapPointPicker({ initial, onCancel, onConfirm }: Props) {
  const userLocation = useAppStore((s) => s.userLocation)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadGoogleMaps()
      .then((maps) => {
        if (!active || !containerRef.current) return
        const center = initial ?? userLocation ?? { lat: 43.7, lng: -79.42 }
        mapRef.current = new maps.Map(containerRef.current, {
          center,
          zoom: initial || userLocation ? 15 : 11,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.RIGHT_TOP },
        })
        // 「我的位置」蓝点参照(内测2-#7):选点时能看清自己在哪
        if (userLocation) {
          new maps.Marker({
            map: mapRef.current,
            position: userLocation,
            title: '我的位置',
            zIndex: 1,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            },
          })
        }
        setReady(true)
      })
      .catch(() => setError('地图加载失败,请稍后重试'))
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function confirm() {
    const c = mapRef.current?.getCenter()
    if (!c) return
    const lat = c.lat()
    const lng = c.lng()
    setSaving(true)
    let address = ''
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=0`,
      )
      const data = await res.json()
      if (data?.display_name) address = data.display_name.split(',').slice(0, 3).join(',')
    } catch { /* 反向地理编码失败不阻断:坐标本身有效 */ }
    onConfirm({ lat, lng, address: address || `地图选点 (${lat.toFixed(4)}, ${lng.toFixed(4)})` })
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 h-14 flex-shrink-0 border-b border-gray-100 pt-safe">
        <button onClick={onCancel} className="p-2 -ml-2 text-gray-600 active:scale-95" aria-label="取消"><X size={22} /></button>
        <span className="text-sm font-semibold text-gray-800">地图选点</span>
        <button onClick={confirm} disabled={!ready || saving}
          className="flex items-center gap-1 text-sm font-semibold text-primary-600 disabled:opacity-50 p-2 -mr-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} />}
          {saving ? '定位中' : '确认'}
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />

        {/* 固定中心针(针尖=地图中心) */}
        {ready && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
            <MapPin size={42} className="text-rose-500 fill-rose-500/25 drop-shadow-md" strokeWidth={2} />
          </div>
        )}

        {/* 提示 */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur rounded-full px-3 py-1.5 shadow-md text-xs font-medium text-gray-600 whitespace-nowrap">
          拖动地图,让红针对准位置
        </div>

        {/* 「我的位置」参照:图例 + 一键回到(内测2-#7) */}
        {ready && userLocation && (
          <>
            <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur rounded-full px-3 py-1.5 shadow-md text-xs font-medium text-gray-600 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white shadow-sm inline-block" /> 我的位置
            </div>
            <button
              onClick={() => { mapRef.current?.panTo(userLocation); mapRef.current?.setZoom(15) }}
              className="absolute bottom-3 right-3 z-10 w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95"
              aria-label="回到我的位置"
            >
              <MapPin size={18} className="text-blue-600" />
            </button>
          </>
        )}

        {(!ready && !error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm text-gray-400">地图加载中…</div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm text-gray-500 px-4 text-center">{error}</div>
        )}
      </div>
    </div>
  )
}
