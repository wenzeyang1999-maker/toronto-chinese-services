import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon, SlidersHorizontal, Sparkles, MessageSquare, Heart, LayoutList, Map } from 'lucide-react'
import { motion } from 'framer-motion'
import ServiceCard from '../../components/ServiceCard/ServiceCard'
import ServiceMap from '../../components/ServiceMap/ServiceMap'
import { useAppStore } from '../../store/appStore'
import type { SearchFilters } from '../../types'
import Header from '../../components/Header/Header'
import InquiryModal from '../../components/InquiryModal/InquiryModal'
import { CATEGORIES } from '../../data/categories'
import { useGeolocation } from '../../hooks/useGeolocation'
import SearchDecisionHeader from './components/SearchDecisionHeader'
import SearchFilterSummary from './components/SearchFilterSummary'
import SearchEmptyState from './components/SearchEmptyState'
import { supabase } from '../../lib/supabase'
import { POST_TYPE_CONFIG } from '../Community/config'
import { expandSemanticSearch } from '../../lib/aiTools'

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

interface ProviderResult {
  id: string
  name: string
  avatar_url: string | null
  bio: string | null
  is_online: boolean
  business_type: 'individual' | 'business'
  skill_tags: string[]
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestLocation = useGeolocation()
  const setSearchFilters       = useAppStore((s) => s.setSearchFilters)
  const searchFilters          = useAppStore((s) => s.searchFilters)
  const userLocation           = useAppStore((s) => s.userLocation)
  const getFilteredServices    = useAppStore((s) => s.getFilteredServices)
  const fetchServicesByKeyword = useAppStore((s) => s.fetchServicesByKeyword)
  const storeServices          = useAppStore((s) => s.services)

  const [localQuery, setLocalQuery] = useState(searchParams.get('q') ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [communityResults, setCommunityResults] = useState<CommunityResult[]>([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [providerResults, setProviderResults] = useState<ProviderResult[]>([])
  const [semanticTerms, setSemanticTerms] = useState<string[]>([])
  const [semanticLoading, setSemanticLoading] = useState(false)
  const [dbResults, setDbResults] = useState<import('../../types').Service[] | null>(null)
  const [dbLoading, setDbLoading] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => {
    const q    = searchParams.get('q') ?? ''
    const cat  = searchParams.get('cat') ?? undefined
    const sort = searchParams.get('sort') as SearchFilters['sortBy'] | null
    setLocalQuery(q)
    setSearchFilters({
      keyword: q || undefined,
      category: cat as never ?? undefined,
      ...(sort ? { sortBy: sort } : {}),
    })

    // Parallel community posts search
    const kw = q.trim()
    if (!kw) {
      setCommunityResults([])
      setProviderResults([])
      setSemanticTerms([])
      setDbResults(null)
      setSearchFilters({ keywordVariants: [] })
      return
    }
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

    // Search providers by skill_tags — exact tag containment (uses GIN index)
    supabase
      .from('users')
      .select('id, name, avatar_url, bio, is_online, business_type, skill_tags')
      .filter('skill_tags', 'cs', `{"${kw}"}`)
      .limit(6)
      .then(({ data }) => setProviderResults((data as ProviderResult[]) ?? []))

    // DB-level keyword search — runs when store services haven't loaded yet
    // (e.g. direct navigation to /search?q=...). Uses trigram index on title/description.
    if (storeServices.length === 0) {
      setDbLoading(true)
      fetchServicesByKeyword(kw).then((rows) => {
        setDbResults(rows)
        setDbLoading(false)
      })
    } else {
      setDbResults(null)
    }

    const timer = window.setTimeout(() => {
      setSemanticLoading(true)
      void expandSemanticSearch(kw).then((terms) => {
        setSemanticTerms(terms)
        setSearchFilters({ keywordVariants: terms })
      }).finally(() => setSemanticLoading(false))
    }, 250)

    return () => window.clearTimeout(timer)
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
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (sortBy !== 'rating') next.set('sort', sortBy)
      else next.delete('sort')
      return next
    }, { replace: true })
  }

  // Use DB results when store hasn't loaded (direct navigation), otherwise client-side filter
  const results = dbResults ?? getFilteredServices()
  const isSearching = dbLoading && dbResults === null

  // Reset to first page whenever filters/query change
  useEffect(() => { setPage(1) }, [searchParams.toString()])

  return (
    <div className="min-h-[100dvh] bg-gray-50">
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
            {/* Map / List toggle */}
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              className={`${viewMode === 'map' ? 'text-primary-600' : 'text-gray-500'} flex-shrink-0`}
              title={viewMode === 'list' ? '切换地图模式' : '切换列表模式'}
            >
              {viewMode === 'list' ? <Map size={18} /> : <LayoutList size={18} />}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`${showFilters ? 'text-primary-600' : 'text-gray-500'} flex-shrink-0`}
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
        {(semanticLoading || semanticTerms.length > 0) && localQuery.trim() && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400">语义联想</span>
            {semanticLoading && <span className="text-[11px] text-gray-400">生成中…</span>}
            {semanticTerms.map((term) => (
              <button
                key={term}
                onClick={() => {
                  setLocalQuery(term)
                  setSearchParams(searchFilters.category ? { q: term, cat: searchFilters.category } : { q: term })
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        )}
        <SearchFilterSummary
          filters={searchFilters}
          onClearCategory={() => handleCategorySelect(undefined)}
          onResetToRating={() => setSearchFilters({ sortBy: 'rating' })}
        />

        {/* ── Map mode ── */}
        {viewMode === 'map' ? (
          <>
            <ServiceMap services={results} />
            {results.length === 0 && communityResults.length === 0 && (
              <SearchEmptyState
                query={localQuery.trim()}
                onOpenInquiry={() => setInquiryOpen(true)}
                onPost={() => navigate('/post')}
              />
            )}
          </>
        ) : isSearching ? (
          <div className="py-12 text-center text-gray-400 text-sm">搜索中…</div>
        ) : results.length === 0 && communityResults.length === 0 ? (
          <SearchEmptyState
            query={localQuery.trim()}
            onOpenInquiry={() => setInquiryOpen(true)}
            onPost={() => navigate('/post')}
          />
        ) : (
          <>
            {results.length > 0 && (
              <>
                <div className="columns-1 md:columns-2 gap-3 [column-fill:_balance]">
                  {results.slice(0, page * PAGE_SIZE).map((svc) => (
                    <div key={svc.id} className="break-inside-avoid mb-3">
                      <ServiceCard service={svc} layout="masonry" />
                    </div>
                  ))}
                </div>
                {results.length > page * PAGE_SIZE && (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="w-full mt-2 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600
                               font-medium hover:bg-gray-50 transition-colors"
                  >
                    加载更多（还有 {results.length - page * PAGE_SIZE} 条）
                  </button>
                )}
                {results.length <= page * PAGE_SIZE && results.length > PAGE_SIZE && (
                  <p className="text-center text-xs text-gray-400 py-3">已显示全部 {results.length} 条结果</p>
                )}
              </>
            )}

            {/* Matching providers section */}
            {providerResults.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">👤</span>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">匹配服务商</h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                  {providerResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/provider/${p.id}`)}
                      className="flex-shrink-0 w-36 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-left
                                 hover:border-primary-200 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.name}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                          flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {p.name.charAt(0)}
                          </div>
                        )}
                        {p.is_online && (
                          <span className="w-2 h-2 rounded-full bg-green-400 ring-2 ring-white flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{p.name}</p>
                      {p.bio && (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-snug">{p.bio}</p>
                      )}
                      {p.skill_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.skill_tags.slice(0, 2).map((tag) => (
                            <span key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
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
