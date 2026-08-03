// ─── Onboarding / 新手引导 ─────────────────────────────────────────────────────
// A first-visit-only guided tour (5 slides) hosted by 邻邻 that introduces the
// core features. Gated by a localStorage flag so returning visitors never see it.
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'
import Mascot, { type MascotPose } from '../Mascot/Mascot'

const SEEN_KEY = 'tcs_onboarded_v1'

interface Slide { pose: MascotPose; title: string; desc: string }

const SLIDES: Slide[] = [
  {
    pose: 'hello',
    title: '你好，我是邻邻 👋',
    desc: '华邻是大多伦多华人的生活服务帮手。30 秒带你逛一圈，了解怎么用。',
  },
  {
    pose: 'curious',
    title: '找靠谱本地服务',
    desc: '搬家、保洁、接送、维修、汽车… 首页搜一下或看地图，附近商家实时在线，直接联系，不用挨家挨户问。',
  },
  {
    pose: 'computer',
    title: '懒得找？让商家来找你',
    desc: '点「发需求 / AI 帮你找」，一句话说清需求，AI 自动把单派给最近的几家商户，坐等他们联系你。',
  },
  {
    pose: 'delivery',
    title: '你是商家？一键上线接单',
    desc: '在「我的」里点「一键翻转」切到服务商模式，就上线显示到地图上，附近的急单会直接找到你。',
  },
  {
    pose: 'front',
    title: '有事随时找邻邻',
    desc: '右下角的「AI 客服」随时帮你答疑、找服务、提交建议或举报。准备好了就开始逛吧！',
  },
]

export default function Onboarding() {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) !== 'true' } catch { return false }
  })
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)

  if (!visible) return null

  function finish() {
    try { localStorage.setItem(SEEN_KEY, 'true') } catch { /* ignore */ }
    setVisible(false)
  }
  function go(next: number) {
    setDir(next > i ? 1 : -1)
    setI(next)
  }

  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 px-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Skip */}
        <button onClick={finish} aria-label="跳过"
          className="absolute top-3 right-3 z-10 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600
                     bg-white/70 backdrop-blur px-2 py-1 rounded-full">
          跳过 <X size={13} />
        </button>

        {/* Mascot stage */}
        <div className="bg-gradient-to-b from-emerald-50 to-white pt-8 pb-4 flex justify-center">
          <div className="h-40 flex items-end overflow-hidden">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={i}
                custom={dir}
                initial={{ opacity: 0, x: dir * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -40 }}
                transition={{ duration: 0.28 }}
              >
                <Mascot pose={slide.pose} size={160} priority />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Text */}
        <div className="px-6 pt-4 pb-5 text-center">
          <AnimatePresence mode="wait">
            <motion.div key={i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{slide.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed min-h-[4.5rem]">{slide.desc}</p>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4 mb-5">
            {SLIDES.map((_, idx) => (
              <button key={idx} onClick={() => go(idx)} aria-label={`第 ${idx + 1} 步`}
                className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-emerald-500' : 'w-1.5 bg-gray-200'}`} />
            ))}
          </div>

          {/* Nav */}
          <div className="flex items-center gap-3">
            {i > 0 ? (
              <button onClick={() => go(i - 1)}
                className="flex items-center justify-center gap-1 px-4 py-3 rounded-2xl border border-gray-200
                           text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                <ArrowLeft size={15} /> 上一步
              </button>
            ) : null}
            <button onClick={() => last ? finish() : go(i + 1)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl
                         bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors shadow-sm shadow-emerald-200">
              {last ? '开始逛逛 🎉' : <>下一步 <ArrowRight size={15} /></>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
