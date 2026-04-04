// ─── Recent Categories ────────────────────────────────────────────────────────
// Reads tcs_browse_history from localStorage, extracts unique categories,
// and shows quick-access chips on the Home page.
// Renders nothing if the user has no browse history.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { getCategoryById } from '../../data/categories'
import type { BrowseEntry } from '../../pages/Profile/types'

export default function RecentCategories() {
  const navigate = useNavigate()

  const recentCats = useMemo(() => {
    try {
      const entries: BrowseEntry[] = JSON.parse(localStorage.getItem('tcs_browse_history') ?? '[]')
      // Deduplicate categories, preserve recency order
      const seen = new Set<string>()
      const cats: string[] = []
      for (const e of entries) {
        if (e.category && !seen.has(e.category)) {
          seen.add(e.category)
          cats.push(e.category)
        }
      }
      return cats.slice(0, 5)
    } catch {
      return []
    }
  }, [])

  if (recentCats.length === 0) return null

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Clock size={13} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">最近浏览的类别</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentCats.map(catId => {
          const cat = getCategoryById(catId as never)
          if (!cat) return null
          return (
            <button
              key={catId}
              onClick={() => navigate(`/search?category=${catId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200
                         bg-white hover:border-primary-300 hover:bg-primary-50
                         text-sm text-gray-700 transition-colors active:scale-95"
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
