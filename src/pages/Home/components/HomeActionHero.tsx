import { MapPin, Sparkles, ArrowRight, ShieldCheck, Star, Clock, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchBar from '../../../components/SearchBar/SearchBar'
import { useAppStore } from '../../../store/appStore'
import { getCategoryById } from '../../../data/categories'
import { useDelayedLoading } from '../../../hooks/useDelayedLoading'

const HISTORY_KEY = 'tcs_search_history'
const MAX_HISTORY = 5

function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}
function addToHistory(kw: string) {
  const prev = getHistory().filter(h => h.toLowerCase() !== kw.toLowerCase())
  localStorage.setItem(HISTORY_KEY, JSON.stringify([kw, ...prev].slice(0, MAX_HISTORY)))
}
function removeFromHistory(kw: string) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(h => h !== kw)))
}

interface Props {
  userHasLocation: boolean
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearch: (keyword: string) => void
  onOpenInquiry: () => void
}

export default function HomeActionHero({
  userHasLocation,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onOpenInquiry,
}: Props) {
  const navigate = useNavigate()
  const services = useAppStore((s) => s.services)
  const servicesLoaded = useAppStore((s) => s.servicesLoaded)
  const showSkeleton = useDelayedLoading(!servicesLoaded)
  const [history, setHistory] = useState<string[]>(getHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [view, setView] = useState<'feed' | 'map'>('feed')   // 推送 / 地图快照
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)   // 鼠标悬停面板时暂停轮播

  // 自动轮播：每 4.5s 在 推送/地图 间切换。dep=[view] 让手动切换后计时重置，
  // 点了不会马上又跳走；悬停时（pausedRef）跳过切换。
  useEffect(() => {
    const t = setInterval(() => {
      if (pausedRef.current) return
      setView((v) => (v === 'feed' ? 'map' : 'feed'))
    }, 4500)
    return () => clearInterval(t)
  }, [view])

  function handleSearch(kw: string) {
    if (!kw.trim()) return
    addToHistory(kw.trim())
    setHistory(getHistory())
    setShowHistory(false)
    onSearch(kw)
  }

  function handleRemoveHistory(kw: string) {
    removeFromHistory(kw)
    setHistory(getHistory())
  }

  const ticker = services
    .filter((s) => s.available)
    .sort((a, b) => {
      if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, 10)

  const tickerLoop = ticker.length > 0 ? [...ticker, ...ticker] : []
  const CARD_H = 60
  const PANEL_H = CARD_H * 4 + 8 * 3   // shared body height for both views
  const nearbyCount = services.filter((s) => s.available).length

  return (
    <div className="relative w-full overflow-hidden bg-[#f7f8fa] border-b border-gray-200 px-4 py-10 md:px-5 md:py-16">
      <div className="mx-auto w-full px-2 md:w-[92%] md:px-0 lg:w-[86%] xl:w-[82%]">
        <div className="relative grid items-center gap-8 lg:min-h-[28rem] lg:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.92fr)] lg:gap-16 xl:gap-20">

          {/* ── Left: headline + search ── */}
          {/* min-w-0: grid items default to min-width:auto and won't shrink below
              their content — a wide child (e.g. the location pill) would otherwise
              stretch this column past the viewport and push the search/AI row right. */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 min-w-0 max-w-[42rem]"
          >
            <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm mb-4">
              <MapPin size={11} className="text-primary-500" />
              {userHasLocation ? '已为您准备附近结果' : '海外华人生活一站式服务'}
              {userHasLocation && (
                <>
                  <span className="text-gray-300 mx-0.5">·</span>
                  <span className="text-gray-400">Canada</span>
                  <span className="text-gray-300">›</span>
                  <span className="text-gray-400">Ontario</span>
                  <span className="text-gray-300">›</span>
                  <span className="text-primary-500 font-semibold">Toronto</span>
                </>
              )}
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl xl:text-6xl leading-[1.1]">
              找本地靠谱服务，
              <br className="hidden md:block" />
              <span className="text-primary-600">少走弯路</span>，直接联系。
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-gray-500 md:text-base md:leading-7">
              先搜索，也可以把需求交给 AI 帮你找。搬家、保洁、接送、装修、现金工，一步进入，更快看到评价、地图和真实联系方式。
            </p>

            <div className="mt-6 flex min-w-0 flex-col gap-3 md:flex-row md:items-stretch">
              <div className="min-w-0 flex-1 relative" ref={searchWrapRef}
                onFocus={() => setShowHistory(true)}
                onBlur={(e) => {
                  if (!searchWrapRef.current?.contains(e.relatedTarget as Node)) setShowHistory(false)
                }}
              >
                <SearchBar
                  value={searchQuery}
                  onChange={onSearchQueryChange}
                  onSearch={handleSearch}
                />
                <AnimatePresence>
                  {showHistory && history.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 overflow-hidden"
                    >
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">最近搜索</p>
                      {history.map(h => (
                        <div key={h} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 group">
                          <Clock size={13} className="text-gray-300 flex-shrink-0" />
                          <button
                            className="flex-1 text-sm text-gray-700 text-left truncate"
                            onMouseDown={() => handleSearch(h)}
                          >
                            {h}
                          </button>
                          <button
                            onMouseDown={(e) => { e.stopPropagation(); handleRemoveHistory(h) }}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition-opacity"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onOpenInquiry}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-700"
              >
                <Sparkles size={15} />
                AI 帮你找
              </motion.button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {['优先看真实评价', '支持微信、电话、站内消息', '需要时才启用定位'].map(t => (
                <span key={t} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500 shadow-sm">
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3 text-sm text-gray-600">
              <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
                <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" />
                <span className="text-xs">优先展示更值得联系的商家</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
                <ArrowRight size={14} className="text-primary-500 flex-shrink-0" />
                <span className="text-xs">搜索、比价、联系一条线完成</span>
              </div>
            </div>
          </motion.div>

          {/* ── Right: live ticker ── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative z-10 hidden lg:block"
          >
            <div
              onMouseEnter={() => { pausedRef.current = true }}
              onMouseLeave={() => { pausedRef.current = false }}
              className="ml-auto max-w-[32rem] rounded-2xl border border-gray-200 bg-white p-4 shadow-lg"
            >

              {/* Header */}
              <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">Live · 实时上线</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-800">最新入驻 &amp; 推广商家</p>
                </div>
                {/* 两视图切换：推送 / 地图快照 */}
                <div className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5 text-xs flex-shrink-0">
                  <button
                    onClick={() => setView('feed')}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-colors
                      ${view === 'feed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {view === 'feed' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                    推送
                  </button>
                  <button
                    onClick={() => setView('map')}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-colors
                      ${view === 'map' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <MapPin size={11} /> 地图
                  </button>
                </div>
              </div>

              {/* Body: 地图快照（点击跳完整地图）or 推送列表 */}
              {view === 'map' ? (
                <button
                  onClick={() => navigate('/map')}
                  className="relative block w-full overflow-hidden rounded-xl border border-gray-100 group"
                  style={{ height: PANEL_H }}
                >
                  {/* map-ish backdrop — 纯 CSS，无瓦片/API 成本 */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50" />
                  <div
                    className="absolute inset-0 opacity-[0.18]"
                    style={{
                      backgroundImage:
                        'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
                      backgroundSize: '30px 30px',
                    }}
                  />
                  {/* faint "river/road" diagonals */}
                  <div className="absolute -inset-8 opacity-[0.12]"
                    style={{ backgroundImage: 'linear-gradient(115deg, transparent 46%, #38bdf8 46%, #38bdf8 52%, transparent 52%)' }} />
                  {/* scattered service pins */}
                  <MapPin size={16} className="absolute text-rose-500 fill-rose-200"    style={{ top: '20%', left: '26%' }} />
                  <MapPin size={14} className="absolute text-amber-500 fill-amber-200"   style={{ top: '58%', left: '18%' }} />
                  <MapPin size={15} className="absolute text-violet-500 fill-violet-200" style={{ top: '30%', right: '22%' }} />
                  <MapPin size={13} className="absolute text-emerald-500 fill-emerald-200" style={{ bottom: '20%', right: '30%' }} />
                  {/* 真·地图截图：放 public/map-snapshot.jpg 即自动启用（覆盖上面的 CSS 底图）；
                      文件缺失时 onError 隐藏自己，回退到 CSS 底图，不会显示裂图。 */}
                  <img
                    src="/map-snapshot.jpg"
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                  {/* 文字清晰度：底部白色渐隐（真图/CSS 底图都适用） */}
                  <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/15 to-transparent" />
                  {/* center CTA */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-transform group-hover:scale-105">
                      <MapPin size={22} />
                    </div>
                    <p className="text-sm font-bold text-gray-800">在地图上找附近服务</p>
                    <p className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-primary-600 shadow-sm">
                      {nearbyCount > 0 ? `${nearbyCount} 个服务 · ` : ''}点击查看地图 <ArrowRight size={12} />
                    </p>
                  </div>
                </button>
              ) : ticker.length === 0 ? (
                (!servicesLoaded && showSkeleton) ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : null
              ) : (
                <div
                  className="relative overflow-hidden rounded-xl"
                  style={{ height: PANEL_H }}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-white to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-white to-transparent" />

                  <style>{`
                    @keyframes ticker-up {
                      0%   { transform: translateY(0); }
                      100% { transform: translateY(-50%); }
                    }
                    .ticker-track {
                      animation: ticker-up ${ticker.length * 3}s linear infinite;
                    }
                    .ticker-track:hover { animation-play-state: paused; }
                  `}</style>

                  <div className="ticker-track flex flex-col gap-2">
                    {tickerLoop.map((svc, i) => {
                      const cat = getCategoryById(svc.category)
                      const priceLabel =
                        svc.priceType === 'hourly' ? `$${svc.price}/时` :
                        svc.priceType === 'fixed'  ? `$${svc.price}起`  : '面议'

                      return (
                        <button
                          key={`${svc.id}-${i}`}
                          onClick={() => navigate(`/service/${svc.id}`)}
                          style={{ minHeight: CARD_H }}
                          className="w-full flex items-center gap-3 rounded-xl border border-gray-100
                                     bg-gray-50 hover:bg-primary-50 hover:border-primary-200
                                     px-4 py-3 text-left transition-all flex-shrink-0 active:scale-[0.98]"
                        >
                          <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 text-lg overflow-hidden shadow-sm">
                            {svc.provider.avatar ? (
                              <img src={svc.provider.avatar} alt="" className="w-9 h-9 object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            ) : (
                              cat?.emoji ?? '🔧'
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate leading-snug">
                              {svc.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400 truncate">{svc.provider.name}</span>
                              {svc.provider.rating > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-amber-500 flex-shrink-0">
                                  <Star size={10} className="fill-amber-400" />
                                  {svc.provider.rating.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-xs font-semibold text-primary-600">{priceLabel}</span>
                            {svc.isPromoted ? (
                              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">推广</span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">新上线</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 轮播指示点（点了也能切） */}
              <div className="mt-3 flex items-center justify-center gap-1.5">
                {(['feed', 'map'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-label={v === 'feed' ? '推送' : '地图'}
                    className={`h-1.5 rounded-full transition-all ${
                      view === v ? 'w-4 bg-primary-500' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => navigate('/search')}
                className="mt-3 w-full flex items-center justify-center gap-1.5
                           rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100
                           py-2.5 text-xs font-medium text-gray-500 transition-colors"
              >
                查看所有服务 <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  )
}
