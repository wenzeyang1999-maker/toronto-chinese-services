// ─── Job List Page ────────────────────────────────────────────────────────────
// Route: /jobs
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, MapPin, X, Briefcase,
  Phone, MessageCircle, Copy, DollarSign, Clock, User, ExternalLink,
} from 'lucide-react'
import ListPageShell from '../../components/ListPageShell/ListPageShell'
import ErrorState from '../../components/ErrorState/ErrorState'
import SortChips from '../../components/SortChips/SortChips'
import { useDelayedLoading } from '../../hooks/useDelayedLoading'
import { useJobStore } from '../../store/jobStore'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import { useAuthStore } from '../../store/authStore'
import { useReadStore } from '../../store/readStore'
import {
  JOB_CATEGORY_CONFIG, JOB_TYPE_CONFIG, SALARY_TYPE_LABEL, getCategoryLabel,
  type Job, type JobCategory, type JobType, type ListingType, type SalaryType,
} from './types'
import { toast } from '../../lib/toast'
import ImgFallback from '../../components/ImgFallback/ImgFallback'
import { useUrlFilters } from '../../lib/useUrlFilters'

import { GTA_FILTER_AREAS as GTA_AREAS } from '../../data/torontoAreas'

// One-tap salary presets — each chip sets both the pay type and a minimum,
// so mixed hourly/monthly listings stay unambiguous ("时薪$22+" vs "月薪$4k+").
const SALARY_PRESETS: { type: SalaryType; min: number; label: string }[] = [
  { type: 'hourly',  min: 18,   label: '时薪 $18+' },
  { type: 'hourly',  min: 22,   label: '时薪 $22+' },
  { type: 'hourly',  min: 25,   label: '时薪 $25+' },
  { type: 'monthly', min: 3000, label: '月薪 $3k+' },
  { type: 'monthly', min: 4000, label: '月薪 $4k+' },
  { type: 'monthly', min: 5000, label: '月薪 $5k+' },
]

export default function JobList() {
  const navigate       = useNavigate()
  const user           = useAuthStore((s) => s.user)
  const { fetchJobs, setFilters, clearFilters, getFilteredJobs, filters, isReady, loadError, hasMore, loadingMore } = useJobStore()
  const sentinelRef = useRef<HTMLDivElement>(null)
  useInfiniteScroll(sentinelRef, { hasMore, loading: loadingMore, onLoadMore: () => fetchJobs(true) })
  const showSkeleton = useDelayedLoading(!isReady)
  const readSet    = useReadStore((s) => s.read)
  const markRead   = useReadStore((s) => s.markRead)

  const [listingType,  setListingType]  = useState<ListingType>('hiring')
  const [showFilters,  setShowFilters]  = useState(false)
  const [localKeyword, setLocalKeyword] = useState(filters.keyword ?? '')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [mobileOpen,   setMobileOpen]   = useState(false)

  useUrlFilters(filters, setFilters, ['listing_type', 'keyword', 'category', 'job_type', 'area', 'salary_type', 'salary_min', 'sortBy'], { numericKeys: ['salary_min'] })

  useEffect(() => { fetchJobs() }, [])
  useEffect(() => {
    setFilters({ listing_type: listingType })
    setSelectedId(null)
    setMobileOpen(false)
  }, [listingType])

  const jobs        = getFilteredJobs()
  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null

  const handleSearch = () => setFilters({ keyword: localKeyword || undefined })

  function handleJobClick(job: Job) {
    markRead('job', job.id)
    setSelectedId(job.id)
    if (window.innerWidth < 1024) setMobileOpen(true)
  }

  const salaryLabel = (job: Job) =>
    job.salary_type === 'negotiable'
      ? '薪资面议'
      : job.salary_min && job.salary_max
        ? `$${job.salary_min}–$${job.salary_max}${SALARY_TYPE_LABEL[job.salary_type]}`
        : job.salary_min
          ? `$${job.salary_min} 起${SALARY_TYPE_LABEL[job.salary_type]}`
          : '薪资面议'

  const topBar = (
    <>
      <div>
        <h1 className="text-lg font-bold text-gray-900">招聘求职</h1>
        <p className="text-xs text-gray-400">华邻 · 职位</p>
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <SubTab active={listingType === 'hiring'} onClick={() => setListingType('hiring')}
          emoji="💼" label="招聘" />
        <SubTab active={listingType === 'seeking'} onClick={() => setListingType('seeking')}
          emoji="🙋" label="求职" />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
          <Search size={15} className="text-gray-400 flex-shrink-0" />
          <input
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索职位、公司..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
          />
          {localKeyword && (
            <button onClick={() => { setLocalKeyword(''); setFilters({ keyword: undefined }) }}>
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>
        <button onClick={handleSearch}
          className="flex-shrink-0 whitespace-nowrap bg-primary-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-primary-700 transition-colors">
          搜索
        </button>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`p-2.5 rounded-xl border transition-colors ${
            showFilters || filters.category || filters.job_type || filters.area || filters.salary_min != null
              ? 'border-primary-400 text-primary-600 bg-primary-50'
              : 'border-gray-200 text-gray-500 bg-white'
          }`}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      <SortChips value={filters.sortBy ?? 'newest'} onChange={(s) => setFilters({ sortBy: s })} priceLabel="薪资" />

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              <FilterRow label="职位类型">
                <Chip active={!filters.category} onClick={() => setFilters({ category: undefined })}>全部</Chip>
                {(Object.keys(JOB_CATEGORY_CONFIG) as JobCategory[]).map((k) => (
                  <Chip key={k} active={filters.category === k}
                    onClick={() => setFilters({ category: filters.category === k ? undefined : k })}>
                    {JOB_CATEGORY_CONFIG[k].emoji} {JOB_CATEGORY_CONFIG[k].label}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="工作性质">
                <Chip active={!filters.job_type} onClick={() => setFilters({ job_type: undefined })}>全部</Chip>
                {(Object.keys(JOB_TYPE_CONFIG) as JobType[]).map((k) => (
                  <Chip key={k} active={filters.job_type === k}
                    onClick={() => setFilters({ job_type: filters.job_type === k ? undefined : k })}>
                    {JOB_TYPE_CONFIG[k].label}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="地区">
                <Chip active={!filters.area} onClick={() => setFilters({ area: undefined })}>全部</Chip>
                {GTA_AREAS.map((a) => (
                  <Chip key={a} active={filters.area === a}
                    onClick={() => setFilters({ area: filters.area === a ? undefined : a })}>
                    {a}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="最低薪资">
                <Chip active={filters.salary_min == null} onClick={() => setFilters({ salary_type: undefined, salary_min: undefined })}>不限</Chip>
                {SALARY_PRESETS.map((p) => {
                  const active = filters.salary_type === p.type && filters.salary_min === p.min
                  return (
                    <Chip key={p.label} active={active}
                      onClick={() => setFilters(active
                        ? { salary_type: undefined, salary_min: undefined }
                        : { salary_type: p.type, salary_min: p.min })}>
                      {p.label}
                    </Chip>
                  )
                })}
              </FilterRow>
              <button onClick={() => { clearFilters(); setLocalKeyword('') }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                清除所有筛选
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )

  const cardList = !isReady ? (showSkeleton ? (
    <div style={{ columns: '200px', columnGap: '10px' }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="break-inside-avoid mb-2.5 bg-white rounded-2xl overflow-hidden animate-pulse"
          style={{ height: i % 2 === 0 ? 200 : 230 }}>
          <div className="w-full h-1/2 bg-gray-100" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  ) : null) : loadError && jobs.length === 0 ? (
    <ErrorState onRetry={() => fetchJobs()} />
  ) : jobs.length === 0 ? (
    filters.keyword || filters.category || filters.job_type || filters.area ? (
      <div className="text-center py-20 text-gray-400">
        <Search size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium text-gray-500">没有找到相关职位</p>
        {filters.keyword && <p className="text-xs text-gray-400 mt-1">"{filters.keyword}"</p>}
        <button onClick={clearFilters}
          className="mt-4 text-xs text-primary-600 bg-primary-50 border border-primary-100 rounded-xl px-4 py-2 font-medium">
          清除筛选条件
        </button>
      </div>
    ) : (
      <div className="text-center py-20 text-gray-400">
        <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">暂无职位</p>
        <button onClick={() => navigate('/jobs/post')}
          className="text-xs text-primary-600 underline mt-1">发布第一个职位</button>
      </div>
    )
  ) : (
    <>
    <div style={{ columns: '200px', columnGap: '10px' }}>
      {jobs.map((job, i) => (
        <motion.div key={job.id}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          onClick={() => handleJobClick(job)}
          className={`break-inside-avoid mb-2.5 bg-white rounded-2xl overflow-hidden
            cursor-pointer transition-all duration-150
            ${readSet.has(`job:${job.id}`) ? 'opacity-75' : ''}
            ${selectedId === job.id ? 'ring-2 ring-primary-400 shadow-md' : 'shadow-sm hover:shadow-md'}`}
        >
          <div className="w-full py-7 flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
            <span className="text-4xl">{JOB_CATEGORY_CONFIG[job.category].emoji}</span>
          </div>
          <div className="p-3">
            <div className="flex items-start justify-between gap-1 mb-1.5">
              <h3 className={`font-semibold text-sm leading-snug line-clamp-2 flex-1
                ${readSet.has(`job:${job.id}`) ? 'text-gray-400' : 'text-gray-900'}`}>
                {job.title}
              </h3>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1 ${JOB_TYPE_CONFIG[job.job_type].color}`}>
                {JOB_TYPE_CONFIG[job.job_type].label}
              </span>
            </div>
            <p
              className="text-xs text-gray-500 mb-1.5 truncate hover:text-primary-600 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); if (job.poster) navigate(`/provider/${job.poster.id}`) }}
            >
              {job.company_name ?? job.poster?.name ?? '雇主'}
            </p>
            <p className="text-sm font-bold text-primary-600 mb-1.5">{salaryLabel(job)}</p>
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              {job.area && job.area.length > 0 && (
                <span className="flex items-center gap-0.5 flex-1 min-w-0 truncate">
                  <MapPin size={10} className="flex-shrink-0" /> {job.area[0]}
                </span>
              )}
              <span className="flex-shrink-0">
                {new Date(job.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
    {hasMore && (
      <div ref={sentinelRef} className="w-full mt-3 py-4 text-center text-xs text-gray-400">
        {loadingMore ? '加载中…' : ''}
      </div>
    )}
    </>
  )

  return (
    <ListPageShell
      pageTitle="华人招聘"
      pageDescription="华人社区工作机会：全职、兼职、实习一站查询，本地雇主直招"
      topBar={topBar}
      countText={`共 ${jobs.length} 个职位`}
      selectedId={selectedId}
      mobileOpen={mobileOpen}
      onCloseMobile={() => setMobileOpen(false)}
      detailDesktop={selectedJob ? <DetailPanel job={selectedJob} salaryLabel={salaryLabel(selectedJob)} onClose={() => setSelectedId(null)} /> : null}
      detailMobile={selectedJob ? <DetailPanel job={selectedJob} salaryLabel={salaryLabel(selectedJob)} onClose={() => setMobileOpen(false)} /> : null}
      leftColWidth={420}
      fabPath={`/jobs/post?type=${listingType}`}
      fabLabel={listingType === 'hiring' ? '发布招聘' : '发布求职'}
      onRefresh={() => fetchJobs()}
    >
      {cardList}
    </ListPageShell>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ job, salaryLabel, onClose }: { job: Job; salaryLabel: string; onClose: () => void }) {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const [copied, setCopied] = useState(false)

  async function copyWechat() {
    if (!job.contact_wechat) return
    try {
      await navigator.clipboard.writeText(job.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(`微信号：${job.contact_wechat}（请手动复制）`)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 leading-tight mb-1">{job.title}</h1>
          <p className="text-sm text-gray-600 font-medium">
            {job.company_name ?? job.poster?.name ?? '雇主'}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${JOB_TYPE_CONFIG[job.job_type].color}`}>
          {JOB_TYPE_CONFIG[job.job_type].label}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <InfoPill icon={<Briefcase size={12} />}
          text={`${JOB_CATEGORY_CONFIG[job.category].emoji} ${JOB_CATEGORY_CONFIG[job.category].label}`} />
        <InfoPill icon={<DollarSign size={12} />} text={salaryLabel} highlight />
        {job.area && job.area.length > 0 && (
          <InfoPill icon={<MapPin size={12} />} text={job.area.join('·')} />
        )}
        <InfoPill icon={<Clock size={12} />}
          text={new Date(job.created_at).toLocaleDateString('zh-CN')} />
      </div>

      <div className="flex gap-2 pt-1">
        <a href={`tel:${job.contact_phone}`}
          className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                     text-white text-sm font-semibold py-2.5 rounded-xl transition-colors active:scale-95">
          <Phone size={15} />
          {job.contact_phone}
        </a>
        {job.contact_wechat && (
          <button onClick={copyWechat}
            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600
                       text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors active:scale-95">
            {copied ? <Copy size={15} /> : <MessageCircle size={15} />}
            {copied ? '已复制' : '微信'}
          </button>
        )}
      </div>

      <Section title="职位描述">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{job.description}</p>
      </Section>

      {job.requirements && (
        <Section title="任职要求">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{job.requirements}</p>
        </Section>
      )}

      {job.benefits && (
        <Section title="福利待遇">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{job.benefits}</p>
        </Section>
      )}

      <Section title="发布者">
        <div className="flex items-center gap-3">
          <div
            onClick={() => job.poster && navigate(`/provider/${job.poster.id}`)}
            className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
          >
            {job.poster?.avatar_url
              ? <ImgFallback src={job.poster.avatar_url} className="w-full h-full rounded-full object-cover" fallback={<User size={16} className="text-primary-600" />} />
              : <User size={16} className="text-primary-600" />
            }
          </div>
          <span className="text-sm font-medium text-gray-800 flex-1">{job.contact_name}</span>
          {job.poster && (
            <button
              onClick={() => navigate(`/provider/${job.poster!.id}`)}
              className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold
                         bg-primary-50 hover:bg-primary-100 border border-primary-200
                         px-3 py-1.5 rounded-xl transition-colors"
            >
              <ExternalLink size={12} />
              查看主页
            </button>
          )}
        </div>
      </Section>

      {(!user || user.id !== job.poster_id) && (
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-center">
          <p className="text-xs text-primary-700 mb-1">有职位要招人？</p>
          <button onClick={() => user ? navigate('/jobs/post') : navigate('/login')}
            className="text-xs text-primary-600 font-semibold underline">
            免费发布招聘
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-4 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  )
}

function InfoPill({ icon, text, highlight = false }: { icon: React.ReactNode; text: string; highlight?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
      highlight ? 'bg-primary-50 text-primary-700 font-semibold' : 'bg-gray-100 text-gray-600'
    }`}>
      {icon}{text}
    </span>
  )
}

function SubTab({ active, onClick, emoji, label }: {
  active: boolean; onClick: () => void; emoji: string; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
        active ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      <span>{emoji}</span>
      {label}
    </button>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
        active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}>
      {children}
    </button>
  )
}
