import { useState } from 'react'
import { X } from 'lucide-react'
import { TORONTO_AREAS, HOT_AREAS } from '../data/constants'

interface Props {
  selectedAreas: string[]
  onChange: (areas: string[]) => void
}

export default function AreaPicker({ selectedAreas, onChange }: Props) {
  const [areaSearch, setAreaSearch]           = useState('')
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false)

  const toggle = (a: string) =>
    onChange(selectedAreas.includes(a) ? selectedAreas.filter(x => x !== a) : [...selectedAreas, a])

  const confirmInput = () => {
    const val = areaSearch.trim()
    if (!val) return
    if (!selectedAreas.includes(val)) onChange([...selectedAreas, val])
    setAreaSearch('')
    setAreaDropdownOpen(false)
  }

  const filteredAreas = areaSearch
    ? TORONTO_AREAS.filter(a => a.toLowerCase().includes(areaSearch.toLowerCase()) && !selectedAreas.includes(a))
    : []

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">服务区域</h3>

      {/* Search input + selected tags inline */}
      <div className="flex flex-wrap items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-transparent bg-white mb-3 relative">
        {selectedAreas.map((a) => (
          <span key={a} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 border border-primary-300 text-primary-600 text-xs font-medium flex-shrink-0">
            {a}
            <button type="button" onClick={() => toggle(a)} className="text-primary-400 hover:text-red-400">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={areaSearch}
          onChange={(e) => { setAreaSearch(e.target.value); setAreaDropdownOpen(true) }}
          onFocus={() => setAreaDropdownOpen(true)}
          onBlur={() => setTimeout(() => setAreaDropdownOpen(false), 150)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmInput())}
          placeholder={selectedAreas.length === 0 ? '搜索或输入区域，Enter 确认...' : '继续添加...'}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        />

        {/* Dropdown */}
        {areaDropdownOpen && filteredAreas.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
            {filteredAreas.map((a) => (
              <button
                key={a}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { toggle(a); setAreaSearch(''); setAreaDropdownOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hot areas */}
      <p className="text-xs text-gray-400 mb-2">热门地区</p>
      <div className="flex flex-wrap gap-2">
        {HOT_AREAS.map((a) => {
          const selected = selectedAreas.includes(a)
          return (
            <button
              key={a}
              type="button"
              onClick={() => toggle(a)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                selected
                  ? 'bg-primary-50 border-primary-400 text-primary-600'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {a}
            </button>
          )
        })}
      </div>
    </div>
  )
}
