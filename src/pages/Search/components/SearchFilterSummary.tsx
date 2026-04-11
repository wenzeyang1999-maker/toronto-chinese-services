import { X } from 'lucide-react'
import { CATEGORIES } from '../../../data/categories'
import type { SearchFilters } from '../../../types'

interface Props {
  filters: SearchFilters
  onClearCategory: () => void
  onResetToRating: () => void
}

const SORT_LABEL: Record<SearchFilters['sortBy'], string> = {
  distance: '距离优先',
  rating: '口碑优先',
  newest: '最新发布',
  price: '价格优先',
}

export default function SearchFilterSummary({ filters, onClearCategory, onResetToRating }: Props) {
  const selectedCategory = filters.category
    ? CATEGORIES.find((cat) => cat.id === filters.category)
    : null

  if (!selectedCategory && filters.sortBy === 'rating') return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {selectedCategory && (
        <button
          onClick={onClearCategory}
          className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
        >
          {selectedCategory.emoji} {selectedCategory.label}
          <X size={12} />
        </button>
      )}

      {filters.sortBy !== 'rating' && (
        <button
          onClick={onResetToRating}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700"
        >
          当前排序：{SORT_LABEL[filters.sortBy]}
          <X size={12} />
        </button>
      )}
    </div>
  )
}
