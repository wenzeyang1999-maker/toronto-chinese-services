import { MapPin, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../store/appStore'
import { useAuthStore } from '../../../store/authStore'
import { supabase } from '../../../lib/supabase'
import { toast } from '../../../lib/toast'

interface Props {
  userHasLocation: boolean
  onOpenInquiry: () => void
}

// 统一商家橱窗:已注册服务商 + 网上收录待认领商家。三态见 status。
type MerchantStatus = 'online' | 'offline' | 'unclaimed'
interface Merchant {
  source: 'user' | 'directory'
  id: string
  name: string
  avatar_url: string | null
  bio: string | null
  category_id: string | null
  area: string | null
  status: MerchantStatus
  verified: boolean
}

export default function HomeActionHero({
  userHasLocation,
  onOpenInquiry,
}: Props) {
  const navigate = useNavigate()
  const services = useAppStore((s) => s.services)
  const user = useAuthStore((s) => s.user)
  const [view, setView] = useState<'feed' | 'map'>('feed')   // 推送 / 地图快照
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

  // 统一商家橱窗:在线接单 / 暂未上线(已注册) / 待认领(网上收录) —— 冷启动填充 + 吸引注册。
  const [ticker, setTicker] = useState<Merchant[]>([])
  const [showcaseLoaded, setShowcaseLoaded] = useState(false)
  useEffect(() => {
    supabase.rpc('merchant_showcase', { p_limit: 24 })
      .then(({ data }) => { if (data) setTicker(data as Merchant[]) })
      .then(() => setShowcaseLoaded(true))
  }, [])

  // 认领收录商家:未登录先去注册/登录(带 claim 意图);已登录直接认领并回填名片。
  async function handleClaim(m: Merchant) {
    if (!user) {
      navigate('/login', { state: { from: '/', claimMerchant: m.id } })
      return
    }
    const { data, error } = await supabase.rpc('claim_merchant', { p_id: m.id })
    if (error || !(data as { ok?: boolean })?.ok) {
      toast(error?.message === 'merchant_unavailable' ? '该商家已被认领' : '认领失败，请重试', 'error')
      return
    }
    toast('认领成功！请完善你的商家资料', 'success')
    setTicker((prev) => prev.filter((x) => x.id !== m.id))
    navigate('/profile')
  }

  const tickerLoop = ticker.length > 0 ? [...ticker, ...ticker] : []
  const CARD_H = 60
  const PANEL_H = CARD_H * 4 + 8 * 3   // shared body height for both views
  const nearbyCount = services.filter((s) => s.available).length

  return (
    <div className="relative w-full overflow-hidden bg-[#f7f8fa] border-b border-gray-200 px-4 py-5 md:px-5 md:py-7">
      <div className="mx-auto w-full px-2 md:w-[92%] md:px-0 lg:w-[86%] xl:w-[82%]">
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.92fr)] lg:gap-16 xl:gap-20">

          {/* ── Left: headline + search ── */}
          {/* min-w-0: grid items default to min-width:auto and won't shrink below
              their content — a wide child (e.g. the location pill) would otherwise
              stretch this column past the viewport and push the search/AI row right. */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 min-w-0 max-w-[42rem]"
          >
            {/* Hero 瘦身(内测 20260818 三):去掉大标题,保留一行说明 + AI 智能匹配入口,
                避免顶部占大块;搜索走顶部 Header,找服务/找订单地图统一在「华邻地图」页。 */}
            <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm mb-3">
              <MapPin size={11} className="text-primary-500" />
              {userHasLocation ? '已为您准备附近结果' : '海外华人生活一站式服务'}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-base font-bold text-gray-800 md:text-lg">
                一句话，<span className="text-primary-600">AI 帮你</span>找到本地靠谱服务
              </p>
              <motion.button
                data-tour="ai-match"
                whileTap={{ scale: 0.97 }}
                onClick={onOpenInquiry}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-700 sm:flex-shrink-0"
              >
                <Sparkles size={16} />
                AI 智能匹配
              </motion.button>
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
              data-tour="map"
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
                !showcaseLoaded ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-8 px-4" style={{ minHeight: 120 }}>
                    <p className="text-3xl mb-2">🤝</p>
                    <p className="text-sm font-semibold text-gray-700">商家陆续入驻中</p>
                    <p className="text-xs text-gray-400 mt-1">完善名片、发布服务，即可在此展示</p>
                  </div>
                )
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
                    {tickerLoop.map((m, i) => {
                      const online    = m.status === 'online'
                      const unclaimed = m.status === 'unclaimed'
                      return (
                        <div
                          key={`${m.id}-${i}`}
                          onClick={() => { if (m.source === 'user') navigate(`/provider/${m.id}`) }}
                          style={{ minHeight: CARD_H }}
                          className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 transition-all flex-shrink-0
                            ${m.source === 'user' ? 'cursor-pointer active:scale-[0.98]' : ''}
                            ${online
                              ? 'bg-white border-emerald-200 hover:border-emerald-300 shadow-sm'
                              : unclaimed
                                ? 'bg-white border-amber-200 hover:border-amber-300'
                                : 'bg-gray-50 border-gray-100 hover:border-gray-200'}`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm ring-1
                            ${online ? 'ring-emerald-200 bg-emerald-50' : unclaimed ? 'ring-amber-200 bg-amber-50' : 'ring-gray-200 bg-gray-100'}
                            ${!online && !unclaimed ? 'grayscale opacity-80' : ''}`}>
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt="" className="w-9 h-9 object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            ) : (
                              <span className={`text-sm font-bold ${online ? 'text-emerald-600' : unclaimed ? 'text-amber-600' : 'text-gray-400'}`}>{(m.name || '商').slice(0, 1)}</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-semibold truncate leading-snug ${online || unclaimed ? 'text-gray-800' : 'text-gray-500'}`}>{m.name || '新商家'}</p>
                              {m.verified && <ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{m.bio || (m.area ? `${m.area} · 华人本地服务` : '华人本地服务商家')}</p>
                          </div>

                          {unclaimed ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClaim(m) }}
                              className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0
                                         text-white bg-amber-500 hover:bg-amber-600 transition-colors"
                            >
                              认领商家
                            </button>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              online ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                                     : 'text-gray-400 bg-gray-100 border border-gray-200'}`}>
                              {online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                              {online ? '在线接单' : '暂未上线'}
                            </span>
                          )}
                        </div>
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
