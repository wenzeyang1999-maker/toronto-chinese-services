import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon, SlidersHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'
import ServiceCard from '../../components/ServiceCard/ServiceCard'
import { useAppStore } from '../../store/appStore'
import Header from '../../components/Header/Header'
import { CATEGORIES } from '../../data/categories'
import type { ServiceCategory } from '../../types'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const setSearchFilters = useAppStore((s) => s.setSearchFilters)
  const searchFilters = useAppStore((s) => s.searchFilters)
  const getFilteredServices = useAppStore((s) => s.getFilteredServices)

  const [localQuery, setLocalQuery] = useState(searchParams.get('q') ?? '')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setLocalQuery(q)
    setSearchFilters({ keyword: q || undefined })
  }, [searchParams, setSearchFilters])

  const handleSearch = () => {
    setSearchParams(localQuery ? { q: localQuery } : {})
    setSearchFilters({ keyword: localQuery || undefined })
  }

  const results = getFilteredServices()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

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
                      onClick={() =>
                        setSearchFilters({ sortBy: opt.value as 'distance' | 'rating' | 'newest' | 'price' })
                      }
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
        <p className="text-xs text-gray-400 mb-3">
          {localQuery ? `"${localQuery}" 的搜索结果：` : '全部服务：'}{results.length} 条
        </p>

        {results.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <SearchIcon size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">没有找到相关服务</p>
            <p className="text-xs mt-1">试试其他关键词，或{' '}
              <button
                onClick={() => navigate('/post')}
                className="text-primary-600 underline"
              >
                发布需求
              </button>
            </p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
            {results.map((svc) => (
              <ServiceCard key={svc.id} service={svc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
