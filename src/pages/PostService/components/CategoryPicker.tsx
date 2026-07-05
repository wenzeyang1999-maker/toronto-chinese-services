import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { CATEGORIES } from '../../../data/categories'
import { MAIN_CAT_IDS, type ServiceSuggestion } from '../data/constants'

interface Props {
  value: string
  confirmedCustom: string
  allServices: ServiceSuggestion[]
  onCategoryChange: (cat: string) => void
  onConfirmedCustomChange: (v: string) => void
  onProceed: () => void
}

export default function CategoryPicker({
  value, confirmedCustom, allServices,
  onCategoryChange, onConfirmedCustomChange, onProceed,
}: Props) {
  const [catSearch, setCatSearch]       = useState('')
  const [customCategory, setCustomCategory] = useState('')

  const confirmCustom = () => {
    const val = customCategory.trim()
    if (!val) return
    onConfirmedCustomChange(val)
    setCustomCategory('')
    onCategoryChange('other')
    onProceed()
  }

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">服务类型 *</h3>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={catSearch}
          onChange={(e) => setCatSearch(e.target.value)}
          placeholder="搜索服务类型，如：钢琴教学、报税..."
          className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
        {catSearch && (
          <button type="button" onClick={() => setCatSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Confirmed custom tag */}
      {confirmedCustom && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => onCategoryChange('other')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all ${
              value === 'other'
                ? 'border-primary-500 bg-primary-50 text-primary-600'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {confirmedCustom}
            <span
              onClick={(e) => { e.stopPropagation(); onConfirmedCustomChange(''); onCategoryChange('moving') }}
              className="text-gray-400 hover:text-red-400 leading-none"
            >✕</span>
          </button>
        </div>
      )}

      {/* Search results */}
      {catSearch && (() => {
        const q = catSearch.toLowerCase()
        const results = allServices.filter(s =>
          s.name.includes(catSearch) || s.tags.some(t => t.includes(q))
        ).slice(0, 12)
        return results.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {results.map(s => {
              const cat = CATEGORIES.find(c => c.id === s.category)
              const isSelected = confirmedCustom === s.name
              return (
                <button key={s.name} type="button"
                  onClick={() => {
                    if (MAIN_CAT_IDS.includes(s.category)) {
                      onConfirmedCustomChange('')
                      onCategoryChange(s.category)
                    } else {
                      onConfirmedCustomChange(s.name)
                      onCategoryChange(s.category)
                    }
                    setCatSearch('')
                    onProceed()
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : `border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:text-primary-600 ${cat?.bgColor ?? ''}`
                  }`}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3">没有找到，可在「其他服务」里自定义</p>
        )
      })()}

      {/* 6-grid — hidden when searching */}
      {!catSearch && (
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.filter(cat => MAIN_CAT_IDS.includes(cat.id)).map((cat) => (
            <button key={cat.id} type="button"
              onClick={() => { onConfirmedCustomChange(''); onCategoryChange(cat.id); onProceed() }}
              className={`flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:p-3 rounded-xl border-2 transition-all ${
                value === cat.id && !confirmedCustom
                  ? `border-primary-500 ${cat.bgColor}`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <img loading="lazy" src={cat.image} alt={cat.postLabel} className="hidden sm:block w-8 h-8 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <span className={`text-xs font-medium ${value === cat.id && !confirmedCustom ? cat.color : 'text-gray-600'}`}>
                {cat.postLabel}
              </span>
            </button>
          ))}
          <button type="button" onClick={() => onCategoryChange('other')}
            className={`flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:p-3 rounded-xl border-2 transition-all ${
              value === 'other' && !confirmedCustom
                ? 'border-primary-500 bg-gray-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <span className="hidden sm:block text-2xl">＋</span>
            <span className={`text-xs font-medium ${value === 'other' && !confirmedCustom ? 'text-primary-600' : 'text-gray-600'}`}>
              其他服务
            </span>
          </button>
        </div>
      )}

      {/* Custom category input */}
      {value === 'other' && !confirmedCustom && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmCustom())}
            placeholder="例：钢琴教学、翻译"
            autoFocus
            className="flex-1 px-4 py-2.5 text-sm border border-primary-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
          <button
            type="button"
            onClick={confirmCustom}
            className="px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors flex-shrink-0"
          >
            确认
          </button>
        </div>
      )}
    </div>
  )
}
