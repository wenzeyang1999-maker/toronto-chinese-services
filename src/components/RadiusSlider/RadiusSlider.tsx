// ─── RadiusSlider ──────────────────────────────────────────────────────────────
// Compact distance-range slider that floats on top of the map (Google Maps /
// FB Marketplace style). Dragging it redraws the map's search-radius circle.
import { MapPin } from 'lucide-react'

interface Props {
  /** Current radius in km. */
  value: number
  /** Called with the new radius as the user drags. */
  onChange: (km: number) => void
}

export const RADIUS_MIN_KM = 1
export const RADIUS_MAX_KM = 25

export default function RadiusSlider({ value, onChange }: Props) {
  return (
    <div className="w-[190px] bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-gray-200 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-gray-500 flex items-center gap-0.5">
          <MapPin size={11} className="text-primary-500" />
          距离范围
        </span>
        <span className="text-xs font-bold text-primary-600">{value} km</span>
      </div>
      <input
        type="range"
        min={RADIUS_MIN_KM}
        max={RADIUS_MAX_KM}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-primary-600 cursor-pointer"
      />
    </div>
  )
}
