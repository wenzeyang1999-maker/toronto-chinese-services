import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon, SlidersHorizontal, Sparkles, MessageSquare, Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import ServiceCard from '../../components/ServiceCard/ServiceCard'
import { useAppStore } from '../../store/appStore'
import Header from '../../components/Header/Header'
import InquiryModal from '../../components/InquiryModal/InquiryModal'
import { CATEGORIES } from '../../data/categories'
import { useGeolocation } from '../../hooks/useGeolocation'
import SearchDecisionHeader from './components/SearchDecisionHeader'
import SearchFilterSummary from './components/SearchFilterSummary'
import SearchEmptyState from './components/SearchEmptyState'
import { supabase } from '../../lib/supabase'
import { POST_TYPE_CONFIG } from '../Community/config'

interface CommunityResult {
  id: string
  title: string
  content: string
  type: string
  area: string
  like_count: number
  created_at: string
  author: { name: string } | null
}

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
  const [communityResults, setCommunityResults] = useState<CommunityResult[]>([])
  const [communityLoading, setCommunityLoading] = useState(false)

  useEffect(() => {
    const q   = searchParams.get('q') ?? ''
    const cat = searchParams.get('cat') ?? undefined
    setLocalQuery(q)
    setSearchFilters({ keyword: q || undefined, category: cat as never ?? undefined })

    // Parallel community posts search
    const kw = q.trim()
    if (!kw) { setCommunityResults([]); return }
    setCommunityLoading(true)
    supabase
      .from('community_posts')
      .select('id, title, content, type, area, like_count, created_at, author:author_id(name)')
      .or(`title.ilike.%${kw}%,content.ilike.%${kw}%`)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setCommunityResults(
          (data ?? []).map((r: any) => ({
            ...r,
            author: Array.isArray(r.author) ? r.author[0] : r.author,
          }))
        )
        setCommunityLoading(false)
      })
  }, [searchParams, setSearchFilters])

  const handleSearch = () => {
    const params: Record<string, string> = {}
    if (localQuery) params.q = localQuery
    if (searchFilters.category) params.cat = searchFilters.category
    setSearchParams(params)
    setSearchFilters({ keyword: localQuery || undefined })
  }

  const handleCategorySelect = (catId: string | undefined) => {
    const next = searchFilters.category === catId ? undefined : catId
    const params: Record<string, string> = {}
    if (localQuery) params.q = localQuery
    if (next) params.cat = next
    setSearchParams(params, { replace: true })
    setSearchFilters({ category: next as never ?? undefined })
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

          {/* L2 category tab bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 pt-2 scrollbar-hide -mx-1 px-1">
            <button
              onClick={() => handleCategorySelect(undefined)}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                !searchFilters.category
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            {CATEGORIES.filter((c) => c.id !== 'other').map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  searchFilters.category === cat.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
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
                    onClick={() => handleCategorySelect(undefined)}
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
                      onClick={() => handleCategorySelect(cat.id)}
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
          count={results.length + communityResults.length}
          hasLocation={!!userLocation}
          sortBy={searchFilters.sortBy}
        />
        <SearchFilterSummary
          filters={searchFilters}
          onClearCategory={() => handleCategorySelect(undefined)}
          onResetToRating={() => setSearchFilters({ sortBy: 'rating' })}
        />

        {results.length === 0 && communityResults.length === 0 ? (
          <SearchEmptyState
            query={localQuery.trim()}
            onOpenInquiry={() => setInquiryOpen(true)}
            onPost={() => navigate('/post')}
          />
        ) : (
          <>
            {results.length > 0 && (
              <div className="flex flex-col gap-2">
                {results.map((svc) => (
                  <ServiceCard key={svc.id} service={svc} />
                ))}
              </div>
            )}

            {/* Community posts section */}
            {(communityLoading || communityResults.length > 0) && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={14} className="text-purple-500" />
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">论坛相关帖子</h3>
                </div>
                {communityLoading ? (
                  <div className="text-xs text-gray-400 py-3 text-center">搜索中…</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {communityResults.map((post) => {
                      const tc = POST_TYPE_CONFIG[post.type]
                      return (
                        <button
                          key={post.id}
                          onClick={() => navigate(`/community/${post.id}`)}
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 text-left hover:border-purple-200 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-800 leading-snug line-clamp-1">
                              {post.title}
                            </span>
                            {tc && (
                              <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tc.color}`}>
                                {tc.emoji} {tc.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{post.content}</p>
                          <div className="flex items-center gap-3 text-[11px] text-gray-400">
                            <span>{post.author?.name ?? '匿名'}</span>
                            <span>{post.created_at.slice(0, 10)}</span>
                            <span className="flex items-center gap-0.5 ml-auto">
                              <Heart size={10} /> {post.like_count}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
