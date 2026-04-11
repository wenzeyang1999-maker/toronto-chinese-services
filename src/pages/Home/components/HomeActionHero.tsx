import { MapPin, Sparkles, ArrowRight, ShieldCheck, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import SearchBar from '../../../components/SearchBar/SearchBar'

interface Props {
  userHasLocation: boolean
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearch: (keyword: string) => void
  onOpenInquiry: () => void
}

const HERO_VISUALS = [
  {
    src: '/images/slides/slide1.svg',
    title: '搬家 / 保洁 / 接送',
    subtitle: '快速找到真实可联系的本地服务',
  },
  {
    src: '/images/slides/slide2.svg',
    title: '地图 / 评价 / 联系方式',
    subtitle: '先判断，再联系，减少来回比较成本',
  },
  {
    src: '/images/slides/slide3.svg',
    title: 'AI 帮你找',
    subtitle: '不想自己筛，也可以直接提交需求',
  },
]

export default function HomeActionHero({
  userHasLocation,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onOpenInquiry,
}: Props) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % HERO_VISUALS.length)
    }, 3200)
    return () => window.clearInterval(timer)
  }, [])

  const current = HERO_VISUALS[active]

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
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">Live Preview</p>
                  <p className="mt-1 text-sm font-semibold text-white">{current.title}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-blue-100/80">
                  <Play size={12} className="fill-current" />
                  动态预览
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/30">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.src}
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className="relative"
                  >
                    <img src={current.src} alt={current.title} className="h-[22rem] w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-blue-100/60">Customer-first flow</p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{current.title}</h3>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-blue-50/75">{current.subtitle}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-3 flex gap-2">
                {HERO_VISUALS.map((item, index) => (
                  <button
                    key={item.src}
                    onClick={() => setActive(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === active ? 'w-10 bg-white' : 'w-4 bg-white/25 hover:bg-white/40'
                    }`}
                    aria-label={item.title}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
