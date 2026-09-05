import { MapPin, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const user = useAuthStore((s) => s.user)

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
  const PANEL_H = CARD_H * 4 + 8 * 3   // 推送列表面板高度

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

            <div className="flex flex-col gap-4">
              <p className="text-base font-bold text-gray-800 md:text-lg">
                一句话，<span className="text-primary-600">AI 帮你</span>找到本地靠谱服务
              </p>
              {/* 两行错开的入口按钮:AI 智能匹配(左) / 华邻地图(右) */}
              <div className="flex flex-col gap-2.5 w-full max-w-md">
                <motion.button
                  data-tour="ai-match"
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenInquiry}
                  className="self-start w-[86%] flex items-center gap-3 rounded-2xl bg-primary-600 px-4 py-3 text-left text-white shadow-md transition-colors hover:bg-primary-700"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 flex-shrink-0">
                    <Sparkles size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">AI 智能匹配</span>
                    <span className="block text-[11px] text-blue-100 leading-tight mt-0.5">描述需求，自动帮你匹配服务商</span>
                  </span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/map')}
                  className="self-end w-[86%] flex items-center gap-3 rounded-2xl border border-primary-200 bg-white px-4 py-3 text-left text-primary-700 shadow-sm transition-colors hover:bg-primary-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 flex-shrink-0">
                    <MapPin size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">华邻地图</span>
                    <span className="block text-[11px] text-gray-400 leading-tight mt-0.5">看看附近有哪些服务商在接单</span>
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* ── Right: live ticker ── */}
          {/* min-w-0 必需:grid 子项默认 min-width:auto,不加会被长商家简介撑破、
              超出视口右侧被裁(表现为卡片「歪了」)。与左栏同理。 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 mt-4 lg:mt-0 min-w-0"
          >
            <div
              data-tour="map"
              className="w-full lg:ml-auto lg:max-w-[32rem] rounded-2xl border border-gray-200 bg-white p-4 shadow-lg"
            >

              {/* Header */}
              <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">Live · 实时上线</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-800">最新入驻 &amp; 推广服务商</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-600 shadow-sm flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  推送
                </span>
              </div>

              {/* Body: 推送列表 */}
              {ticker.length === 0 ? (
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
                          onClick={() => navigate(m.source === 'user' ? `/provider/${m.id}` : `/merchant/${m.id}`)}
                          style={{ minHeight: CARD_H }}
                          className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 transition-all flex-shrink-0
                            cursor-pointer active:scale-[0.98]
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

              <button
                onClick={() => navigate('/merchants')}
                className="mt-3 w-full flex items-center justify-center gap-1.5
                           rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100
                           py-2.5 text-xs font-medium text-gray-500 transition-colors"
              >
                查看全部商家 <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  )
}
