// ─── LocationInput ─────────────────────────────────────────────────────────────
// Shared component: user types a postal code or address → click 定位 → Nominatim
// geocodes it → parent receives { address, lat, lng }.
// Fully optional — parent still submits even if user skips.
import { useState } from 'react'
import { MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export interface LocationResult {
  address: string
  lat: number
  lng: number
}

interface Props {
  onChange: (loc: LocationResult | null) => void
}

export default function LocationInput({ onChange }: Props) {
  const [input,  setInput]  = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [confirmed, setConfirmed] = useState('')
  const [errMsg, setErrMsg] = useState('')

  async function geocode() {
    const q = input.trim()
    if (!q) return
    setStatus('loading')
    setErrMsg('')
    try {
      const url = `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(q + ', Ontario, Canada')}` +
        `&format=json&limit=1&addressdetails=0`
      const res  = await fetch(url)
      const data = await res.json()
      if (!data.length) {
        setStatus('error')
        setErrMsg('未找到此地址，请检查邮编或地址后重试')
        onChange(null)
        return
      }
      const { lat, lon, display_name } = data[0]
      const loc: LocationResult = { address: q, lat: parseFloat(lat), lng: parseFloat(lon) }
      setConfirmed(display_name)
      onChange(loc)
      setStatus('ok')
    } catch {
      setStatus('error')
      setErrMsg('定位服务暂时不可用，请稍后重试')
      onChange(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2.5 border border-gray-200 rounded-xl px-3 py-2.5
                        focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-transparent bg-white">
          <MapPin size={15} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); if (status !== 'idle') setStatus('idle') }}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), geocode())}
            placeholder="邮编或地址，例如：M3C 1A1"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
          />
          {status === 'ok' && <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />}
        </div>
        <button
          type="button"
          onClick={geocode}
          disabled={!input.trim() || status === 'loading'}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold
                     rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
        >
          {status === 'loading'
            ? <Loader2 size={14} className="animate-spin" />
            : <MapPin size={14} />}
          定位
        </button>
      </div>

      {status === 'ok' && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 size={11} />
          已定位：{confirmed.split(',').slice(0, 3).join(',')}
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={11} /> {errMsg}
        </p>
      )}
      <p className="text-xs text-gray-400">选填 · 填写后客户可在地图上找到您的大致位置</p>
    </div>
  )
}
