import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon, SlidersHorizontal, Sparkles, MessageSquare, Heart, LayoutList, Map, Bell, BellOff, Wrench, Briefcase, Home, ShoppingBag, Calendar, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
import PageMeta from '../../components/PageMeta/PageMeta'
import { useAuthStore } from '../../store/authStore'
import { subscribeToWebPush } from '../../lib/webPush'
import { toast } from '../../lib/toast'
import {
  getSavedSearches, saveSearch, removeSavedSearch,
  markSearchSeen, type SavedSearch,
} from '../../lib/savedSearches'
import { ServiceListSkeleton, GlobalSearchSkeleton, CommunityPostSkeleton } from '../../components/Skeleton/Skeleton'

// ─── Global search types ──────────────────────────────────────────────────────
type GlobalResultType = 'service' | 'job' | 'property' | 'secondhand' | 'event' | 'community'
type GlobalTab = 'all' | GlobalResultType

interface GlobalResult {
  id: string
  type: GlobalResultType
  title: string
  subtitle: string
  emoji: string
  path: string
}

const GLOBAL_TYPE_META: Record<GlobalResultType, { label: string; icon: React.ReactNode; emoji: string; color: string }> = {
  service:    { label: '服务',  icon: <Wrench      size={13} />, emoji: '🔧', color: 'text-primary-600 bg-primary-50' },
  job:        { label: '招聘',  icon: <Briefcase   size={13} />, emoji: '💼', color: 'text-purple-600 bg-purple-50'  },
  property:   { label: '房源',  icon: <Home        size={13} />, emoji: '🏠', color: 'text-green-600 bg-green-50'    },
  secondhand: { label: '闲置',  icon: <ShoppingBag size={13} />, emoji: '🛒', color: 'text-orange-600 bg-orange-50'  },
  event:      { label: '活动',  icon: <Calendar    size={13} />, emoji: '🎉', color: 'text-pink-600 bg-pink-50'      },
  community:  { label: '社区',  icon: <Users       size={13} />, emoji: '🏘️', color: 'text-teal-600 bg-teal-50'     },
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === keyword.toLowerCase()
          ? <mark key={i} className="bg-yellow-100 text-yellow-800 rounded px-0.5">{p}</mark>
          : p
      )}
    </>
  )
}

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

  const user = useAuthStore((s) => s.user)
  const isGlobal = searchParams.get('global') === '1'
  const [localQuery, setLocalQuery] = useState(searchParams.get('q') ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
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

  // Global search state
  const [globalResults, setGlobalResults]   = useState<GlobalResult[]>([])
  const [globalLoading, setGlobalLoading]   = useState(false)
  const [globalSearched, setGlobalSearched] = useState(false)
  const [globalTab, setGlobalTab]           = useState<GlobalTab>('all')

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

    // Search providers — fuzzy partial match on skill_tags + name (RPC unnest + ILIKE),
    // so "维" matches a provider tagged "维修". Exact containment missed partial terms.
    supabase
      .rpc('search_providers_by_keyword', { kw })
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

  // Global search — runs when in global mode and query changes
  useEffect(() => {
    const q = (searchParams.get('q') ?? '').trim()
    if (!isGlobal || !q) { setGlobalResults([]); setGlobalSearched(false); return }
    setGlobalLoading(true)
    setGlobalSearched(true)

    Promise.all([
      supabase.from('services').select('id, title, category_id, area').ilike('title', `%${q}%`).eq('is_available', true).limit(20),
      supabase.from('jobs').select('id, title, company_name, job_type').ilike('title', `%${q}%`).eq('is_active', true).limit(20),
      supabase.from('properties').select('id, title, listing_type, area').ilike('title', `%${q}%`).eq('is_active', true).limit(20),
      supabase.from('secondhand').select('id, title, category, area').ilike('title', `%${q}%`).eq('is_active', true).eq('is_sold', false).limit(20),
      supabase.from('events').select('id, title, event_type, event_date').ilike('title', `%${q}%`).eq('is_active', true).limit(20),
      supabase.from('community_posts').select('id, title, content, type, area').or(`title.ilike.%${q}%,content.ilike.%${q}%`).limit(20),
    ]).then(([svc, jobs, props, sh, evts, comm]) => {
      setGlobalResults([
        ...(svc.data  ?? []).map((r: any) => ({ id: r.id, type: 'service'    as GlobalResultType, title: r.title, subtitle: [r.category_id, r.area].filter(Boolean).join(' · '), emoji: '🔧', path: `/service/${r.id}` })),
        ...(jobs.data ?? []).map((r: any) => ({ id: r.id, type: 'job'        as GlobalResultType, title: r.title, subtitle: r.company_name ?? '', emoji: '💼', path: `/jobs/${r.id}` })),
        ...(props.data ?? []).map((r: any) => ({ id: r.id, type: 'property'  as GlobalResultType, title: r.title, subtitle: (r.area ?? []).join('·'), emoji: '🏠', path: `/realestate/${r.id}` })),
        ...(sh.data   ?? []).map((r: any) => ({ id: r.id, type: 'secondhand' as GlobalResultType, title: r.title, subtitle: (r.area ?? []).join('·'), emoji: '🛒', path: `/secondhand/${r.id}` })),
        ...(evts.data ?? []).map((r: any) => ({ id: r.id, type: 'event'      as GlobalResultType, title: r.title, subtitle: r.event_date?.slice(0, 10) ?? '', emoji: '🎉', path: `/events/${r.id}` })),
        ...(comm.data ?? []).map((r: any) => ({ id: r.id, type: 'community'  as GlobalResultType, title: r.title, subtitle: r.type, emoji: '🏘️', path: `/community/${r.id}` })),
      ])
      setGlobalLoading(false)
    })
  }, [searchParams, isGlobal])

  const handleSearch = () => {
    const params: Record<string, string> = {}
    if (localQuery) params.q = localQuery
    if (searchFilters.category) params.cat = searchFilters.category
    setSearchParams(params)
    setSearchFilters({ keyword: localQuery || undefined })
  }

  const query = searchParams.get('q') ?? ''
  const currentCategory = searchFilters.category

  // Load saved searches (DB-backed for logged-in users, localStorage otherwise)
  useEffect(() => {
    void getSavedSearches().then(setSavedSearches)
  }, [user])

  // Mark saved search as seen when the user lands on a matching query
  useEffect(() => {
    if (!query) return
    const match = savedSearches.find(
      s => s.keyword.toLowerCase() === query.toLowerCase() && s.category === currentCategory
    )
    if (match && match.newCount > 0) {
      void markSearchSeen(match.id).then(getSavedSearches).then(setSavedSearches)
    }
  }, [query, currentCategory, savedSearches])

  const currentlySaved = savedSearches.some(
    s => s.keyword.toLowerCase() === query.toLowerCase() && s.category === currentCategory
  )

  async function handleToggleSave() {
    if (!query) return
    if (currentlySaved) {
      const match = savedSearches.find(
        s => s.keyword.toLowerCase() === query.toLowerCase() && s.category === currentCategory
      )
      if (match) await removeSavedSearch(match.id)
      setSavedSearches(await getSavedSearches())
      toast('已取消订阅', 'success')
    } else {
      await saveSearch(query, currentCategory)
      setSavedSearches(await getSavedSearches())
      toast('搜索已订阅，有新结果时在通知中心提醒你', 'success')
      // Request push permission and subscribe if user is logged in
      if (user && 'Notification' in window) {
        const perm = await Notification.requestPermission()
        if (perm === 'granted') subscribeToWebPush(user.id)
      }
    }
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
  const baseResults = dbResults ?? getFilteredServices()
  // Price / online filters apply to BOTH paths (the DB keyword search doesn't
  // filter by them, and getFilteredServices already did — harmlessly idempotent).
  const results = baseResults.filter((s) => {
    if (searchFilters.onlineOnly && !s.provider.isOnline) return false
    if (searchFilters.minPrice != null || searchFilters.maxPrice != null) {
      if (s.priceType === 'negotiable') return false
      const p = parseFloat(s.price)
      if (Number.isNaN(p)) return false
      if (searchFilters.minPrice != null && p < searchFilters.minPrice) return false
      if (searchFilters.maxPrice != null && p > searchFilters.maxPrice) return false
    }
    return true
  })
  const isSearching = dbLoading && dbResults === null

  // Reset to first page whenever filters/query change
  useEffect(() => { setPage(1) }, [searchParams.toString()])

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <PageMeta title="服务搜索" description="搜索多伦多华人服务：搬家、保洁、装修、接送、育儿等，找到靠谱服务商" />
      <Header />
      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />

      {/* Search header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <SearchIcon size={16} className="text-gray-400 flex-shrink-0" />
              <input
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索服务..."
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-900"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              className="text-primary-600 text-sm font-medium flex-shrink-0 whitespace-nowrap"
            >
              搜索
            </button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setInquiryOpen(true)}
              className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700
                         text-white text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors flex-shrink-0 whitespace-nowrap"
            >
              <Sparkles size={12} className="flex-shrink-0" />
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

          {/* Mode toggle: 服务搜索 ↔ 全站搜索 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5 mt-2 self-start">
            <button
              onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.delete('global'); return n }, { replace: true })}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isGlobal ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Wrench size={12} />服务搜索
            </button>
            <button
              onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('global', '1'); return n }, { replace: true })}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isGlobal ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={12} />全站搜索
            </button>
          </div>

          {/* L2 category tab bar — only shown in service mode */}
          <div className={`flex gap-2 overflow-x-auto pb-1 pt-2 scrollbar-hide -mx-1 px-1 ${isGlobal ? 'hidden' : ''}`}>
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

          {/* Filter panel — only shown in service mode */}
          {showFilters && !isGlobal && (
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

              {/* Online toggle + price range */}
              <div className="mb-3 space-y-3">
                <button
                  onClick={() => setSearchFilters({ onlineOnly: !searchFilters.onlineOnly })}
                  className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    searchFilters.onlineOnly
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  ⚡ 仅看在线接单
                </button>

                <div>
                  <p className="text-xs text-gray-500 mb-2">价格区间</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" inputMode="numeric" min={0}
                      value={searchFilters.minPrice ?? ''}
                      onChange={(e) => setSearchFilters({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="最低"
                      className="w-20 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary-400"
                    />
                    <span className="text-gray-300 text-xs">—</span>
                    <input
                      type="number" inputMode="numeric" min={0}
                      value={searchFilters.maxPrice ?? ''}
                      onChange={(e) => setSearchFilters({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="最高"
                      className="w-20 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary-400"
                    />
                    {(searchFilters.minPrice != null || searchFilters.maxPrice != null) && (
                      <button
                        onClick={() => setSearchFilters({ minPrice: undefined, maxPrice: undefined })}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        清除
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">按价格筛选会排除「面议」服务</p>
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

      {/* ── Global search results ── */}
      {isGlobal && (
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Tab filter */}
          {globalSearched && (
            <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4 overflow-x-auto scrollbar-hide">
              {(['all', 'service', 'job', 'property', 'secondhand', 'event', 'community'] as GlobalTab[]).map(t => {
                const count = t === 'all' ? globalResults.length : globalResults.filter(r => r.type === t).length
                return (
                  <button key={t} onClick={() => setGlobalTab(t)}
                    className={`flex items-center gap-1 flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      globalTab === t ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {t === 'all' ? '全部' : GLOBAL_TYPE_META[t as GlobalResultType].label}
                    {count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        globalTab === t ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-500'
                      }`}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {globalLoading ? (
            <GlobalSearchSkeleton count={6} />
          ) : !globalSearched ? (
            <div className="text-center py-20 text-gray-300">
              <SearchIcon size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">输入关键词，搜索全站内容</p>
            </div>
          ) : (() => {
            const filtered = globalTab === 'all' ? globalResults : globalResults.filter(r => r.type === globalTab)
            return filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-sm">未找到相关结果</p>
                <p className="text-xs text-gray-300 mt-1">试试其他关键词，或切换"服务搜索"查看专项结果</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-3">共 {filtered.length} 条结果</p>
                <AnimatePresence>
                  {filtered.map((item, i) => {
                    const meta = GLOBAL_TYPE_META[item.type]
                    return (
                      <motion.button
                        key={`${item.type}-${item.id}`}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.02 }}
                        onClick={() => navigate(item.path)}
                        className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-4 py-3.5 text-left hover:border-primary-200 hover:shadow-md transition-all"
                      >
                        <span className="text-xl flex-shrink-0">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            <Highlight text={item.title} keyword={searchParams.get('q') ?? ''} />
                          </p>
                          {item.subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.subtitle}</p>}
                        </div>
                        <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${meta.color}`}>
                          {meta.icon}{meta.label}
                        </span>
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Service search results ── */}
      {!isGlobal && <div className="max-w-2xl mx-auto px-4 py-4">
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
        {query && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              {(semanticLoading || semanticTerms.length > 0) && (
                <>
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
                </>
              )}
            </div>
            <button
              onClick={handleToggleSave}
              className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                currentlySaved
                  ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {currentlySaved
                ? <><BellOff size={10} /> 已订阅</>
                : <><Bell size={10} /> 订阅通知</>}
            </button>
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
          <ServiceListSkeleton count={5} />
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
                  {results.slice(0, page * PAGE_SIZE).map((svc, i) => (
                    <motion.div
                      key={svc.id}
                      className="break-inside-avoid mb-3"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.04 }}
                    >
                      <ServiceCard service={svc} layout="masonry" />
                    </motion.div>
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
                          <img loading="lazy" src={p.avatar_url} alt={p.name}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
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
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map(i => <CommunityPostSkeleton key={i} />)}
                  </div>
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
      </div>}
    </div>
  )
}
