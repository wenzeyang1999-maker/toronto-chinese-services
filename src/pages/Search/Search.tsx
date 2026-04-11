import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon, SlidersHorizontal, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import ServiceCard from '../../components/ServiceCard/ServiceCard'
import { useAppStore } from '../../store/appStore'
import Header from '../../components/Header/Header'
import InquiryModal from '../../components/InquiryModal/InquiryModal'
import { CATEGORIES } from '../../data/categories'
import type { ServiceCategory } from '../../types'
import { useGeolocation } from '../../hooks/useGeolocation'
import SearchDecisionHeader from './components/SearchDecisionHeader'
import SearchFilterSummary from './components/SearchFilterSummary'
import SearchEmptyState from './components/SearchEmptyState'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestLocation = useGeolocation()
  const setSearchFilters = useAppStore((s) => s.setSearchFilters)
  const searchFilters = useAppStore((s) => s.searchFilters)
  const userLocation = useAppStore((s) => s.userLocation)
  const getFilteredServices = useAppStore((s) => s.getFilteredServices)

  const [localQuery, setLocalQuery] = useState(searchParams.get('q') ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const [inquiryOpen, setInquiryOpen] = useState(false)

  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setLocalQuery(q)
    setSearchFilters({ keyword: q || undefined })
  }, [searchParams, setSearchFilters])

  const handleSearch = () => {
    if (localQuery.trim()) requestLocation()
    setSearchParams(localQuery ? { q: localQuery } : {})
    setSearchFilters({ keyword: localQuery || undefined })
  }

  const handleSortChange = (sortBy: 'distance' | 'rating' | 'newest' | 'price') => {
    setSearchFilters({ sortBy })
    if (sortBy === 'distance' && !userLocation) requestLocation()
  }

  const results = getFilteredServices()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />

      {/* Search header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <SearchIcon size={16} className="text-gray-400" />
              <input
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索服务..."
                className="flex-1 bg-transparent outline-none text-sm text-gray-900"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              className="text-primary-600 text-sm font-medium"
            >
              搜索
            </button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setInquiryOpen(true)}
              className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700
                         text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors flex-shrink-0"
            >
              <Sparkles size={12} />
              AI帮你找
            </motion.button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`${showFilters ? 'text-primary-600' : 'text-gray-500'}`}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-3 overflow-hidden"
            >
              {/* Category filter */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">服务类型</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSearchFilters({ category: undefined })}
                    className={`text-xs px-3 py-1.5 rounded-full ${
                      !searchFilters.category
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    全部
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() =>
                        setSearchFilters({
                          category:
                            searchFilters.category === cat.id
                              ? undefined
                              : (cat.id as ServiceCategory),
                        })
                      }
                      className={`text-xs px-3 py-1.5 rounded-full ${
                        searchFilters.category === cat.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <p className="text-xs text-gray-500 mb-2">排序方式</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'distance', label: '距离' },
                    { value: 'rating', label: '好评' },
                    { value: 'newest', label: '最新' },
                    { value: 'price', label: '价格' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSortChange(opt.value as 'distance' | 'rating' | 'newest' | 'price')}
                      className={`text-xs px-3 py-1.5 rounded-full ${
                        searchFilters.sortBy === opt.value
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {!userLocation && searchFilters.sortBy === 'distance' && (
          <p className="text-xs text-amber-600 mb-3">
            搜索或切换到距离排序时会请求位置权限，用于展示附近结果。
          </p>
        )}
        <SearchDecisionHeader
          query={localQuery.trim()}
          count={results.length}
          hasLocation={!!userLocation}
          sortBy={searchFilters.sortBy}
        />
        <SearchFilterSummary
          filters={searchFilters}
          onClearCategory={() => setSearchFilters({ category: undefined })}
          onResetToRating={() => setSearchFilters({ sortBy: 'rating' })}
        />

        {results.length === 0 ? (
          <SearchEmptyState
            query={localQuery.trim()}
            onOpenInquiry={() => setInquiryOpen(true)}
            onPost={() => navigate('/post')}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((svc) => (
              <ServiceCard key={svc.id} service={svc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
