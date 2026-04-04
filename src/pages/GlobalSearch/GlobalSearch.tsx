// ─── Global Search Page ────────────────────────────────────────────────────────
// Route: /search-all?q=xxx
// Queries all 5 content tables in parallel, shows results grouped by type.
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronLeft, Wrench, Briefcase, Home, ShoppingBag, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type ResultType = 'service' | 'job' | 'property' | 'secondhand' | 'event'
type TabKey = 'all' | ResultType

interface Result {
  id: string
  type: ResultType
  title: string
  subtitle: string
  emoji: string
  path: string
}

const TYPE_META: Record<ResultType, { label: string; icon: React.ReactNode; emoji: string; color: string }> = {
  service:    { label: '服务',  icon: <Wrench      size={14} />, emoji: '🔧', color: 'text-primary-600 bg-primary-50' },
  job:        { label: '招聘',  icon: <Briefcase   size={14} />, emoji: '💼', color: 'text-purple-600 bg-purple-50'  },
  property:   { label: '房源',  icon: <Home        size={14} />, emoji: '🏠', color: 'text-green-600 bg-green-50'    },
  secondhand: { label: '闲置',  icon: <ShoppingBag size={14} />, emoji: '🛒', color: 'text-orange-600 bg-orange-50'  },
  event:      { label: '活动',  icon: <Calendar    size={14} />, emoji: '🎉', color: 'text-pink-600 bg-pink-50'      },
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',        label: '全部' },
  { key: 'service',    label: '服务' },
  { key: 'job',        label: '招聘' },
  { key: 'property',   label: '房源' },
  { key: 'secondhand', label: '闲置' },
  { key: 'event',      label: '活动' },
]

const PATH_PREFIX: Record<ResultType, string> = {
  service:    '/service',
  job:        '/jobs',
  property:   '/realestate',
  secondhand: '/secondhand',
  event:      '/events',
}

// Highlight matching keyword in text
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

export default function GlobalSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query,   setQuery]   = useState(searchParams.get('q') ?? '')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [tab,     setTab]     = useState<TabKey>('all')
  const [searched, setSearched] = useState(false)

  // Run search when q param changes
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setQuery(q)
    if (q.trim()) runSearch(q.trim())
    else { setResults([]); setSearched(false) }
  }, [searchParams])

  function handleSubmit() {
    const q = query.trim()
    if (!q) return
    setSearchParams({ q })
  }

  async function runSearch(q: string) {
    setLoading(true)
    setSearched(true)

    const [services, jobs, properties, secondhand, events] = await Promise.all([
      supabase.from('services')
        .select('id, title, category_id, area')
        .ilike('title', `%${q}%`)
        .eq('is_available', true)
        .limit(20),
      supabase.from('jobs')
        .select('id, title, company_name, job_type')
        .ilike('title', `%${q}%`)
        .eq('is_active', true)
        .limit(20),
      supabase.from('properties')
        .select('id, title, listing_type, area')
        .ilike('title', `%${q}%`)
        .eq('is_active', true)
        .limit(20),
      supabase.from('secondhand')
        .select('id, title, category, area')
        .ilike('title', `%${q}%`)
        .eq('is_active', true)
        .eq('is_sold', false)
        .limit(20),
      supabase.from('events')
        .select('id, title, event_type, event_date')
        .ilike('title', `%${q}%`)
        .eq('is_active', true)
        .limit(20),
    ])

    const mapped: Result[] = [
      ...(services.data ?? []).map((r: any) => ({
        id: r.id, type: 'service' as ResultType,
        title: r.title,
        subtitle: [r.category_id, r.area].filter(Boolean).join(' · '),
        emoji: TYPE_META.service.emoji,
        path: `${PATH_PREFIX.service}/${r.id}`,
      })),
      ...(jobs.data ?? []).map((r: any) => ({
        id: r.id, type: 'job' as ResultType,
        title: r.title,
        subtitle: [r.company_name, r.job_type === 'fulltime' ? '全职' : r.job_type === 'parttime' ? '兼职' : r.job_type].filter(Boolean).join(' · '),
        emoji: TYPE_META.job.emoji,
        path: `${PATH_PREFIX.job}/${r.id}`,
      })),
      ...(properties.data ?? []).map((r: any) => ({
        id: r.id, type: 'property' as ResultType,
        title: r.title,
        subtitle: [r.listing_type === 'rent' ? '出租' : r.listing_type === 'sale' ? '出售' : '合租', (r.area ?? []).join('·')].filter(Boolean).join(' · '),
        emoji: TYPE_META.property.emoji,
        path: `${PATH_PREFIX.property}/${r.id}`,
      })),
      ...(secondhand.data ?? []).map((r: any) => ({
        id: r.id, type: 'secondhand' as ResultType,
        title: r.title,
        subtitle: [(r.area ?? []).join('·')].filter(Boolean).join(' · '),
        emoji: TYPE_META.secondhand.emoji,
        path: `${PATH_PREFIX.secondhand}/${r.id}`,
      })),
      ...(events.data ?? []).map((r: any) => ({
        id: r.id, type: 'event' as ResultType,
        title: r.title,
        subtitle: r.event_date ? r.event_date.slice(0, 10) : '',
        emoji: TYPE_META.event.emoji,
        path: `${PATH_PREFIX.event}/${r.id}`,
      })),
    ]

    setResults(mapped)
    setLoading(false)
  }

  const filtered = tab === 'all' ? results : results.filter(r => r.type === tab)
  const counts: Record<TabKey, number> = {
    all:        results.length,
    service:    results.filter(r => r.type === 'service').length,
    job:        results.filter(r => r.type === 'job').length,
    property:   results.filter(r => r.type === 'property').length,
    secondhand: results.filter(r => r.type === 'secondhand').length,
    event:      results.filter(r => r.type === 'event').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="搜索服务、招聘、房源、闲置、活动…"
            className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
          />
        </div>
        <button onClick={handleSubmit}
          className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex-shrink-0">
          搜索
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Tabs — only show after a search */}
        {searched && (
          <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4 overflow-x-auto scrollbar-hide">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1 flex-shrink-0 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === t.key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
                {counts[t.key] > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    tab === t.key ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-500'
                  }`}>{counts[t.key]}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">搜索中…</div>
        ) : !searched ? (
          <div className="text-center py-20 text-gray-300">
            <Search size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">输入关键词，搜索全站内容</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-sm">未找到相关结果</p>
            <p className="text-xs text-gray-300 mt-1">试试其他关键词</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">共 {filtered.length} 条结果</p>
            <AnimatePresence>
              {filtered.map((item, i) => {
                const meta = TYPE_META[item.type]
                return (
                  <motion.button
                    key={`${item.type}-${item.id}`}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => navigate(item.path)}
                    className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-4 py-3.5 text-left hover:border-primary-200 hover:shadow-md transition-all"
                  >
                    <span className="text-xl flex-shrink-0">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        <Highlight text={item.title} keyword={query} />
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${meta.color}`}>
                      {meta.icon}
                      {meta.label}
                    </span>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
