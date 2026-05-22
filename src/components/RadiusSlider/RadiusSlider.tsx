// ─── RadiusSlider ──────────────────────────────────────────────────────────────
// Continuous distance-range slider (Google Maps / FB Marketplace style).
// Dragging it changes the search radius; the map below redraws + re-zooms.
import { MapPin } from 'lucide-react'

interface Props {
  /** Current radius in km. */
  value: number
  /** Called with the new radius as the user drags. */
  onChange: (km: number) => void
  /** Disable interaction (e.g. when location is unavailable). */
  disabled?: boolean
  /** Optional hint shown under the slider. */
  hint?: string
}

export const RADIUS_MIN_KM = 1
export const RADIUS_MAX_KM = 25

export default function RadiusSlider({ value, onChange, disabled = false, hint }: Props) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm transition-opacity ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <MapPin size={13} className="text-primary-500" />
          距离范围
        </span>
        <span className="text-sm font-bold text-primary-600">{value} km</span>
      </div>

      <input
        type="range"
        min={RADIUS_MIN_KM}
        max={RADIUS_MAX_KM}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-primary-600 cursor-pointer disabled:cursor-not-allowed"
      />

      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-400">{RADIUS_MIN_KM} km</span>
        <span className="text-[10px] text-gray-400">{RADIUS_MAX_KM} km</span>
      </div>

      {hint && <p className="text-[11px] text-gray-400 mt-1.5">{hint}</p>}
    </div>
  )
}
