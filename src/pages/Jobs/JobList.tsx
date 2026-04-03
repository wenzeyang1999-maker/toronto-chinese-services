// ─── Job List Page ────────────────────────────────────────────────────────────
// Route: /jobs
// Desktop (≥ lg): Indeed-style split — left scrollable list, right detail panel
// Mobile  (< lg): single column list, clicking navigates to /jobs/:id
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, MapPin, Plus, X, Briefcase,
  Phone, MessageCircle, Copy, DollarSign, Clock, User, ExternalLink,
} from 'lucide-react'
import Header from '../../components/Header/Header'
import SectionTabs from '../../components/SectionTabs/SectionTabs'
import { useJobStore } from '../../store/jobStore'
import { useAuthStore } from '../../store/authStore'
import {
  JOB_CATEGORY_CONFIG, JOB_TYPE_CONFIG, SALARY_TYPE_LABEL, getCategoryLabel,
  type Job, type JobCategory, type JobType, type ListingType,
} from './types'

const GTA_AREAS = [
  '多伦多市区', '北约克', '士嘉堡', '密西沙加', '万锦',
  '列治文山', '奥克维尔', '宾顿', '安省其他',
]

export default function JobList() {
  const navigate       = useNavigate()
  const user           = useAuthStore((s) => s.user)
  const { fetchJobs, setFilters, clearFilters, getFilteredJobs, filters, isReady } = useJobStore()
  const [listingType,  setListingType]  = useState<ListingType>('hiring')
  const [showFilters,  setShowFilters]  = useState(false)
  const [localKeyword, setLocalKeyword] = useState(filters.keyword ?? '')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchJobs() }, [])

  // Sync listing_type filter with sub-tab
  useEffect(() => {
    setFilters({ listing_type: listingType })
    setSelectedId(null)
  }, [listingType])

  const jobs       = getFilteredJobs()
  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null

  // No auto-selection — user clicks to open detail panel

  // Scroll detail panel back to top when selection changes
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedId])

  const handleSearch = () => setFilters({ keyword: localKeyword || undefined })

  function handleJobClick(job: Job) {
    if (window.innerWidth < 1024) {
      navigate(`/jobs/${job.id}`)
    } else {
      setSelectedId(job.id)
    }
  }

  const salaryLabel = (job: Job) =>
    job.salary_type === 'negotiable'
      ? '薪资面议'
      : job.salary_min && job.salary_max
        ? `$${job.salary_min}–$${job.salary_max}${SALARY_TYPE_LABEL[job.salary_type]}`
        : job.salary_min
          ? `$${job.salary_min} 起${SALARY_TYPE_LABEL[job.salary_type]}`
          : '薪资面议'

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <Header />

      {/* ── Section tabs ────────────────────────────────────────────────────── */}
      <div className="bg-white flex-shrink-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          <SectionTabs active="jobs" onChange={() => {}} containerClassName="px-0" />
        </div>
      </div>

      {/* ── Search / filter bar ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 py-3 flex-shrink-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto space-y-3">

          {/* Title + post button */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">招聘求职</h1>
              <p className="text-xs text-gray-400">大多伦多华人职位</p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => user ? navigate(`/jobs/post?type=${listingType}`) : navigate('/login')}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700
                         text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Plus size={15} />
              {listingType === 'hiring' ? '发布招聘' : '发布求职'}
            </motion.button>
          </div>

          {/* 招聘 / 求职 sub-tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <SubTab active={listingType === 'hiring'} onClick={() => setListingType('hiring')}
              emoji="💼" label="招聘" />
            <SubTab active={listingType === 'seeking'} onClick={() => setListingType('seeking')}
              emoji="🙋" label="求职" />
          </div>

          {/* Search row */}
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
              className="bg-primary-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-primary-700 transition-colors">
              搜索
            </button>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`p-2.5 rounded-xl border transition-colors ${
                showFilters || filters.category || filters.job_type || filters.area
                  ? 'border-primary-400 text-primary-600 bg-primary-50'
                  : 'border-gray-200 text-gray-500 bg-white'
              }`}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* Filter panel */}
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
                  <button onClick={() => { clearFilters(); setLocalKeyword('') }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    清除所有筛选
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Content area (fills remaining height) ───────────────────────────── */}
      <div className="flex-1 overflow-hidden w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto flex gap-0 py-3">

        {/* ── Left: job list ───────────────────────────────────────────────── */}
        <div className={`flex flex-col overflow-hidden
          ${selectedJob ? 'hidden lg:flex lg:w-[420px] lg:flex-shrink-0' : 'w-full'}`}>
          <p className="text-xs text-gray-400 mb-2 flex-shrink-0">共 {jobs.length} 个职位</p>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {!isReady ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              ))
            ) : jobs.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无职位</p>
                <button onClick={() => navigate('/jobs/post')}
                  className="text-xs text-primary-600 underline mt-1">发布第一个职位</button>
              </div>
            ) : jobs.map((job, i) => (
              <motion.div key={job.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => handleJobClick(job)}
                className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all duration-150
                  ${selectedId === job.id
                    ? 'border-primary-400 shadow-md ring-1 ring-primary-200'
                    : 'border-gray-100 shadow-sm hover:border-primary-200 hover:shadow-md'
                  }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
                    {job.title}
                  </h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${JOB_TYPE_CONFIG[job.job_type].color}`}>
                    {JOB_TYPE_CONFIG[job.job_type].label}
                  </span>
                </div>
                <p
                  className="text-xs text-gray-500 mb-2 hover:text-primary-600 cursor-pointer inline-block"
                  onClick={(e) => { e.stopPropagation(); job.poster && navigate(`/provider/${job.poster.id}`) }}
                >
                  {job.company_name ?? job.poster?.name ?? '雇主'}
                </p>
                <div className="flex items-center flex-wrap gap-1.5 mb-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {JOB_CATEGORY_CONFIG[job.category].emoji} {getCategoryLabel(job)}
                  </span>
                  {job.area && job.area.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
                      <MapPin size={10} /> {job.area.join('·')}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-primary-600">{salaryLabel(job)}</span>
                  <span className="text-[11px] text-gray-400">
                    {new Date(job.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Right: detail panel (desktop only) ───────────────────────────── */}
        <AnimatePresence mode="wait">
          {selectedJob && (
            <motion.div key={selectedJob.id}
              ref={detailRef}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="hidden lg:flex flex-col flex-1 overflow-y-auto ml-4"
            >
              <DetailPanel job={selectedJob} salaryLabel={salaryLabel(selectedJob)}
                onClose={() => setSelectedId(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Inline detail panel (desktop right column) ───────────────────────────────
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
      alert(`微信号：${job.contact_wechat}`)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      {/* Title + type */}
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

      {/* Info pills */}
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

      {/* Contact */}
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

      {/* Description */}
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

      {/* Poster */}
      <Section title="发布者">
        <div className="flex items-center gap-3">
          <div
            onClick={() => job.poster && navigate(`/provider/${job.poster.id}`)}
            className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
          >
            {job.poster?.avatar_url
              ? <img src={job.poster.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
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

      {/* CTA */}
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

// ─── Small helpers ────────────────────────────────────────────────────────────
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
