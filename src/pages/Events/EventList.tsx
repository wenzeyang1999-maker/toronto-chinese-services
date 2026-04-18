// ─── Events List Page ──────────────────────────────────────────────────────────
// Route: /events
// Desktop (≥ lg): split — left scrollable list, right detail panel
// Mobile  (< lg): single column, clicking navigates to /events/:id
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, MapPin, X,
  Phone, MessageCircle, Copy, Calendar, User, ExternalLink, Clock,
} from 'lucide-react'
import Header from '../../components/Header/Header'
import PostFAB from '../../components/PostFAB/PostFAB'
import SectionTabs from '../../components/SectionTabs/SectionTabs'
import { useEventsStore } from '../../store/eventsStore'
import { useAuthStore } from '../../store/authStore'
import {
  EVENT_TYPE_CONFIG, getPriceLabel, formatEventDate, formatEventTime, isUpcoming,
  type Event, type EventType,
} from './types'

const GTA_AREAS = [
  '多伦多市区', '北约克', '士嘉堡', '密西沙加', '万锦',
  '列治文山', '奥克维尔', '宾顿', '安省其他',
]

export default function EventList() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const { fetchEvents, setFilters, clearFilters, getFilteredEvents, filters, isReady } = useEventsStore()

  const [showFilters,  setShowFilters]  = useState(false)
  const [localKeyword, setLocalKeyword] = useState(filters.keyword ?? '')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchEvents() }, [])

  const events       = getFilteredEvents()
  const selectedEvent = events.find((e) => e.id === selectedId) ?? null

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedId])

  const handleSearch = () => setFilters({ keyword: localKeyword || undefined })

  function handleItemClick(ev: Event) {
    if (window.innerWidth < 1024) {
      navigate(`/events/${ev.id}`)
    } else {
      setSelectedId(ev.id)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <Header />

      {/* ── Section tabs ────────────────────────────────────────────────────── */}
      <div className="bg-white flex-shrink-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          <SectionTabs active="events" onChange={() => {}} containerClassName="px-0" />
        </div>
      </div>

      {/* ── Search / filter bar ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 py-3 flex-shrink-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto space-y-3">

          {/* Title */}
          <div>
            <h1 className="text-lg font-bold text-gray-900">大多广场</h1>
            <p className="text-xs text-gray-400">同城活动·集市摊位·公益慈善</p>
          </div>

          {/* L2 section tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {([
              { id: 'events',  label: '同城活动', available: true },
              { id: 'market',  label: '集市摊位', available: false },
              { id: 'charity', label: '公益慈善', available: false },
            ] as const).map((sec) => (
              <button
                key={sec.id}
                disabled={!sec.available}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative ${
                  sec.available && sec.id === 'events'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                {sec.label}
                {!sec.available && (
                  <span className="absolute -top-1.5 -right-1 text-[8px] font-bold bg-gray-300 text-gray-500 rounded-full px-1 leading-tight">
                    即将
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Upcoming toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ upcoming_only: true })}
              className={`text-sm px-3 py-1.5 rounded-xl border transition-colors font-medium ${
                filters.upcoming_only
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              即将开始
            </button>
            <button
              onClick={() => setFilters({ upcoming_only: false })}
              className={`text-sm px-3 py-1.5 rounded-xl border transition-colors font-medium ${
                !filters.upcoming_only
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              全部活动
            </button>
          </div>

          {/* Search row */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input
                value={localKeyword}
                onChange={(e) => setLocalKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索活动名称、地点…"
                className="flex-1 bg-transparent py-2.5 text-sm outline-none"
              />
              {localKeyword && (
                <button onClick={() => { setLocalKeyword(''); setFilters({ keyword: undefined }) }}>
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>
            <button onClick={handleSearch}
              className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold
                         px-4 rounded-xl transition-colors">
              搜索
            </button>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl border transition-colors ${
                showFilters ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-gray-200 text-gray-500'
              }`}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pb-1">
                  {/* Category */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">活动类型</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((t) => (
                        <button key={t}
                          onClick={() => setFilters({ event_type: filters.event_type === t ? undefined : t })}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            filters.event_type === t
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {EVENT_TYPE_CONFIG[t].emoji} {EVENT_TYPE_CONFIG[t].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Area */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">地区</p>
                    <div className="flex flex-wrap gap-1.5">
                      {GTA_AREAS.map((a) => (
                        <button key={a}
                          onClick={() => setFilters({ area: filters.area === a ? undefined : a })}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            filters.area === a
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={() => { clearFilters(); setLocalKeyword('') }}
                    className="text-xs text-primary-600 font-medium">
                    重置筛选
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto flex gap-4">

          {/* Left list */}
          <div className={`${selectedEvent ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 overflow-y-auto pt-3 pb-6`}>
            <p className="text-xs text-gray-400 mb-2 px-0.5">共 {events.length} 个活动</p>

            {!isReady ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无活动</p>
                <button onClick={() => user ? navigate('/events/post') : navigate('/login')}
                  className="text-xs text-primary-600 underline mt-1">发布第一个活动</button>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => {
                  const cfg = EVENT_TYPE_CONFIG[ev.event_type]
                  const past = !isUpcoming(ev)
                  return (
                    <motion.button
                      key={ev.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleItemClick(ev)}
                      className={`w-full text-left bg-white rounded-2xl border transition-all p-4
                                  flex gap-3 items-start
                                  ${selectedId === ev.id
                                    ? 'border-primary-400 shadow-md ring-1 ring-primary-200'
                                    : 'border-gray-100 hover:border-gray-300 hover:shadow-sm'
                                  } ${past ? 'opacity-60' : ''}`}
                    >
                      {/* Date badge */}
                      <div className="flex-shrink-0 w-12 flex flex-col items-center bg-primary-50 rounded-xl py-1.5 px-1 text-center">
                        <span className="text-[10px] font-bold text-primary-400 leading-none">
                          {new Date(ev.event_date + 'T00:00:00').toLocaleString('zh-CN', { month: 'short' })}
                        </span>
                        <span className="text-xl font-extrabold text-primary-700 leading-tight">
                          {new Date(ev.event_date + 'T00:00:00').getDate()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{ev.title}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
                            {cfg.emoji} {cfg.label}
                          </span>
                        </div>
                        {(ev.location_name || ev.address) && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 truncate mb-1">
                            <MapPin size={11} className="flex-shrink-0" />
                            {ev.location_name ?? ev.address}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
                          {ev.event_time && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock size={11} />
                              {formatEventTime(ev.event_time)}
                            </p>
                          )}
                          <p className={`text-xs font-bold ${ev.price ? 'text-primary-600' : 'text-green-600'}`}>
                            {getPriceLabel(ev)}
                          </p>
                          {past && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">已结束</span>}
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right detail panel */}
          {selectedEvent && (
            <div ref={detailRef}
              className="hidden lg:block flex-1 overflow-y-auto pt-3 pb-6">
              <DetailPanel ev={selectedEvent} onClose={() => setSelectedId(null)} />
            </div>
          )}

          {/* Placeholder when nothing selected */}
          {!selectedEvent && (
            <div className="hidden lg:flex flex-1 items-center justify-center text-gray-300 pt-3">
              <div className="text-center">
                <Calendar size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">选择一个活动查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FAB — 发布 */}
      {user && <PostFAB onClick={() => navigate('/events/post')} />}
    </div>
  )
}

// ─── Inline detail panel ──────────────────────────────────────────────────────
function DetailPanel({ ev, onClose }: { ev: Event; onClose: () => void }) {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const [imgIdx,  setImgIdx]  = useState(0)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => { setImgIdx(0) }, [ev.id])

  const cfg = EVENT_TYPE_CONFIG[ev.event_type]

  async function copyWechat() {
    if (!ev.contact_wechat) return
    try {
      await navigator.clipboard.writeText(ev.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert(`微信号：${ev.contact_wechat}`)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
      {/* Close button */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
          <X size={18} />
        </button>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
          {cfg.emoji} {cfg.label}
        </span>
        {!isUpcoming(ev) && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">已结束</span>
        )}
      </div>

      {/* Images */}
      {ev.images.length > 0 && (
        <div>
          <div className="aspect-video overflow-hidden bg-gray-100">
            <img src={ev.images[imgIdx]} alt={ev.title} className="w-full h-full object-cover" />
          </div>
          {ev.images.length > 1 && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white">
              {ev.images.map((img, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                    imgIdx === i ? 'border-primary-500' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-5 space-y-5">
        {/* Title + price */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className={`text-2xl font-bold ${ev.price ? 'text-primary-600' : 'text-green-600'}`}>
              {getPriceLabel(ev)}
            </p>
          </div>
          <h2 className="text-xl font-bold text-gray-900 leading-snug">{ev.title}</h2>
        </div>

        {/* Date/time/location */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar size={15} className="text-primary-500 flex-shrink-0" />
            <span className="font-semibold">{formatEventDate(ev.event_date)}</span>
            {ev.event_time && (
              <span className="text-gray-500">
                {formatEventTime(ev.event_time)}
                {ev.event_end_time && ` – ${formatEventTime(ev.event_end_time)}`}
              </span>
            )}
          </div>
          {(ev.location_name || ev.address) && (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin size={15} className="text-primary-500 flex-shrink-0 mt-0.5" />
              <span>
                {ev.location_name && <span className="font-semibold">{ev.location_name}</span>}
                {ev.location_name && ev.address && <span className="text-gray-400"> · </span>}
                {ev.address && <span className="text-gray-500">{ev.address}</span>}
              </span>
            </div>
          )}
          {ev.area && ev.area.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ev.area.map((a) => (
                <span key={a} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-500">{a}</span>
              ))}
            </div>
          )}
          {ev.max_attendees && (
            <p className="text-xs text-gray-500">👥 名额限制：{ev.max_attendees} 人</p>
          )}
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">活动详情</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ev.description}</p>
        </div>

        {/* Contact */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">联系主办方</h3>
          <div className="flex items-center gap-3 mb-3">
            <div
              onClick={() => ev.poster && navigate(`/provider/${ev.poster.id}`)}
              className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0
                         cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
            >
              {ev.poster?.avatar_url
                ? <img src={ev.poster.avatar_url} alt={ev.contact_name} className="w-full h-full rounded-full object-cover" />
                : <User size={16} className="text-primary-600" />
              }
            </div>
            <span className="text-sm font-semibold text-gray-900 flex-1">{ev.contact_name}</span>
            {ev.poster && (
              <button
                onClick={() => navigate(`/provider/${ev.poster!.id}`)}
                className="flex items-center gap-1 text-xs text-primary-600 font-semibold
                           bg-primary-50 hover:bg-primary-100 border border-primary-200
                           px-2.5 py-1.5 rounded-xl transition-colors"
              >
                <ExternalLink size={11} />查看主页
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <a href={`tel:${ev.contact_phone}`}
              className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                         active:scale-95 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
              <Phone size={15} />{ev.contact_phone}
            </a>
            {ev.contact_wechat && (
              <button onClick={copyWechat}
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600
                           active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all">
                {copied ? <Copy size={15} /> : <MessageCircle size={15} />}
                {copied ? '已复制' : '微信'}
              </button>
            )}
          </div>
          {ev.contact_wechat && (
            <p className="text-xs text-gray-400 mt-1.5 text-center">微信号：{ev.contact_wechat}</p>
          )}
        </div>

        {(!user || user.id !== ev.poster_id) && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-center">
            <p className="text-xs text-primary-700 mb-1">有活动要发布？</p>
            <button onClick={() => user ? navigate('/events/post') : navigate('/login')}
              className="text-xs text-primary-600 font-semibold underline">免费发布活动</button>
          </div>
        )}
      </div>
    </div>
  )
}
