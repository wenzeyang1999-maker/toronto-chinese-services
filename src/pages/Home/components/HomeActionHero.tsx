import { MapPin, Sparkles, ArrowRight, ShieldCheck, Star, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import SearchBar from '../../../components/SearchBar/SearchBar'
import { useAppStore } from '../../../store/appStore'
import { getCategoryById } from '../../../data/categories'

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
  const navigate  = useNavigate()
  const services  = useAppStore((s) => s.services)

  // Pick top 4: promoted first, then by rating, max 4
  const preview = services
    .filter((s) => s.available)
    .sort((a, b) => {
      if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1
      return b.provider.rating - a.provider.rating
    })
    .slice(0, 4)

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-slate-950 px-4 py-10 md:px-5 md:py-14">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ x: [0, 24, 0], y: [0, -18, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-20 right-[10%] h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 18, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-0 left-[5%] h-72 w-72 rounded-full bg-indigo-300/10 blur-3xl"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:auto,24px_24px,24px_24px]" />
      </div>

      <div className="mx-auto w-full px-2 md:w-[92%] md:px-0 lg:w-[86%] xl:w-[82%]">
        <div className="relative grid items-center gap-8 lg:min-h-[30rem] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:gap-20 xl:gap-24">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 max-w-[42rem]"
          >
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-blue-50/90">
              <MapPin size={12} />
              {userHasLocation ? '已为您准备附近结果' : '服务覆盖大多伦多华人生活场景'}
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl xl:text-6xl">
              找本地靠谱华人服务，
              <br className="hidden md:block" />
              少走弯路，直接联系。
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-50/80 md:text-base md:leading-7">
              先搜索，也可以把需求交给 AI 帮你找。搬家、保洁、接送、装修、现金工，一步进入，
              更快看到评价、地图和真实联系方式。
            </p>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-stretch">
              <div className="min-w-0 flex-1">
                <SearchBar
                  value={searchQuery}
                  onChange={onSearchQueryChange}
                  onSearch={onSearch}
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onOpenInquiry}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-primary-700 shadow-lg transition-colors hover:bg-blue-50"
              >
                <Sparkles size={16} className="text-primary-500" />
                AI 帮你找
              </motion.button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-blue-100/80">
              <span className="rounded-full bg-white/10 px-3 py-1">优先看真实评价</span>
              <span className="rounded-full bg-white/10 px-3 py-1">支持微信、电话、站内消息</span>
              <span className="rounded-full bg-white/10 px-3 py-1">地图和距离仅在需要时才启用定位</span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/80">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <ShieldCheck size={16} className="text-emerald-300" />
                <span>优先展示更值得联系的商家</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <ArrowRight size={16} className="text-cyan-300" />
                <span>搜索、比价、联系一条线完成</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative z-10 hidden lg:block"
          >
            <div className="relative ml-auto max-w-[32rem] rounded-[2rem] border border-white/12 bg-white/8 p-4 shadow-2xl backdrop-blur-xl">

              {/* Header */}
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">Live · 实时服务</p>
                  <p className="mt-1 text-sm font-semibold text-white">平台真实在线商家</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  实时
                </div>
              </div>

              {/* Service cards */}
              <div className="space-y-2">
                {preview.length === 0 ? (
                  // Skeleton while loading
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
                  ))
                ) : (
                  preview.map((svc, i) => {
                    const cat = getCategoryById(svc.category)
                    const priceLabel = svc.priceType === 'hourly'
                      ? `$${svc.price}/时`
                      : svc.priceType === 'fixed'
                      ? `$${svc.price}起`
                      : '面议'

                    return (
                      <motion.button
                        key={svc.id}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.07 }}
                        onClick={() => navigate(`/service/${svc.id}`)}
                        className="w-full flex items-center gap-3 rounded-2xl border border-white/8
                                   bg-white/6 hover:bg-white/12 active:scale-[0.98]
                                   px-4 py-3 text-left transition-all"
                      >
                        {/* Category icon */}
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-lg">
                          {svc.provider.avatar ? (
                            <img src={svc.provider.avatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
                          ) : (
                            cat?.emoji ?? '🔧'
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate leading-snug">
                            {svc.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-blue-100/60 truncate">{svc.provider.name}</span>
                            {svc.provider.rating > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-amber-400 flex-shrink-0">
                                <Star size={10} className="fill-amber-400" />
                                {svc.provider.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price + promoted */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs font-semibold text-cyan-300">{priceLabel}</span>
                          {svc.isPromoted && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-300/80">
                              <Zap size={9} className="fill-amber-300/80" /> 推广
                            </span>
                          )}
                        </div>
                      </motion.button>
                    )
                  })
                )}
              </div>

              {/* Footer CTA */}
              <button
                onClick={() => navigate('/search')}
                className="mt-3 w-full flex items-center justify-center gap-1.5
                           rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10
                           py-2.5 text-xs font-medium text-blue-100/70 transition-colors"
              >
                查看全部服务 <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
