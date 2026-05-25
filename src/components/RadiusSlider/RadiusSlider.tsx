// ─── RadiusSlider ──────────────────────────────────────────────────────────────
// Non-linear distance slider: 0-50 slider positions map to 1-50 km (fine),
// 50-100 slider positions map to 50-500 km (coarse). Result: 50 km sits at the
// exact midpoint of the track, giving precise control near the user and still
// reaching province-wide distances.
import { MapPin } from 'lucide-react'

interface Props {
  value: number           // km (external representation)
  onChange: (km: number) => void
}

export const RADIUS_MIN_KM = 1
export const RADIUS_MAX_KM = 500

// Internal slider range is 0–100
const SLIDER_MIN = 0
const SLIDER_MAX = 100

export function sliderToKm(pos: number): number {
  if (pos <= 50) return Math.round(1 + (pos / 50) * 49)        // 1–50 km
  return Math.round(50 + ((pos - 50) / 50) * 450)               // 50–500 km
}

export function kmToSlider(km: number): number {
  if (km <= 50) return ((km - 1) / 49) * 50
  return 50 + ((km - 50) / 450) * 50
}

export default function RadiusSlider({ value, onChange }: Props) {
  const sliderPos = kmToSlider(Math.max(RADIUS_MIN_KM, Math.min(RADIUS_MAX_KM, value)))

  return (
    <div className="w-[190px] bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-gray-200 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-gray-500 flex items-center gap-0.5">
          <MapPin size={11} className="text-primary-500" />
          距离范围
        </span>
        <span className="text-xs font-bold text-primary-600">
          {value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value} km
        </span>
      </div>
      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={1}
        value={sliderPos}
        onChange={(e) => onChange(sliderToKm(Number(e.target.value)))}
        className="w-full h-1 accent-primary-600 cursor-pointer"
      />
      <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
        <span>1</span>
        <span>50</span>
        <span>500 km</span>
      </div>
    </div>
  )
}
