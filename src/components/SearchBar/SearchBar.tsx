import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'

const SUGGESTIONS = [
  '搬家公司', '保洁阿姨', '机场接送', '水电维修',
  '日结工作', '私房菜', '装修报价', '钟点工',
]

interface Props {
  value?: string
  onChange?: (v: string) => void
  onSearch?: (kw: string) => void
}

export default function SearchBar({ value, onChange, onSearch }: Props = {}) {
  const [internalQuery, setInternalQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const setSearchFilters = useAppStore((s) => s.setSearchFilters)

  // Support both controlled (value/onChange props) and uncontrolled modes
  const query = value !== undefined ? value : internalQuery
  const setQuery = (v: string) => {
    if (onChange) onChange(v)
    else setInternalQuery(v)
  }

  const handleSearch = (kw: string) => {
    if (!kw.trim()) return
    if (onSearch) { onSearch(kw.trim()); return }
    setSearchFilters({ keyword: kw.trim(), category: undefined })
    navigate(`/search?q=${encodeURIComponent(kw.trim())}`)
    setFocused(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(query)
  }

  const filteredSuggestions = query
    ? SUGGESTIONS.filter((s) => s.includes(query))
    : SUGGESTIONS

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 bg-white rounded-2xl px-3 py-3 shadow-md transition-all duration-200 ${
          focused ? 'ring-2 ring-primary-400 shadow-lg' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="搜索您需要的服务..."
          className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 text-base min-w-0"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        )}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSearch(query)}
          className="flex-shrink-0 text-white bg-primary-600 hover:bg-primary-700 transition-colors rounded-xl p-1.5"
          aria-label="搜索"
        >
          <Search size={16} />
        </motion.button>
      </div>

      {/* Suggestions dropdown */}
      {focused && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-30"
        >
          <div className="p-3">
            <p className="text-xs text-gray-400 mb-2 px-1">热门搜索</p>
            <div className="flex flex-wrap gap-2">
              {filteredSuggestions.map((s) => (
                <button
                  key={s}
                  onMouseDown={() => handleSearch(s)}
                  className="text-sm text-gray-600 bg-gray-50 hover:bg-primary-50 hover:text-primary-600 px-3 py-1.5 rounded-full transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
