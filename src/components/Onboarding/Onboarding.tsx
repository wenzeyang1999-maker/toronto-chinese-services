// ─── Onboarding / 新手引导（聚光灯式） ─────────────────────────────────────────
// Highlights real UI elements one-by-one: dims everything else, spotlights the
// target, points an arrow at it, and explains it. First-visit visitors get it
// automatically; on desktop a small semi-transparent「再来一次」dot lets anyone
// replay it. Steps whose target element is missing (e.g. desktop-only FABs on
// mobile) are skipped automatically.
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, Sparkles } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import Mascot from '../Mascot/Mascot'

const SEEN_KEY = 'tcs_onboarded_v2'
const PAD = 8  // spotlight padding around target

interface Step { sel: string; title: string; desc: string }

const STEPS: Step[] = [
  { sel: '[data-tour="search"]',       title: '搜本地服务',   desc: '一句话搜你要的师傅或商家，附近结果优先展示。' },
  { sel: '[data-tour="ai-match"]',     title: 'AI 帮你找',    desc: '懒得逐个找？描述需求，AI 自动把单派给最近的几家商户，坐等联系。' },
  { sel: '[data-tour="categories"]',   title: '热门服务直达', desc: '搬家、保洁、接送、维修… 常用类目一键进入。' },
  { sel: '[data-tour="map"]',          title: '地图找附近',   desc: '看谁正在附近实时在线接单，就近直接联系。' },
  { sel: '[data-tour="post-request"]', title: '发布需求',     desc: '把需求发出去，让附近商家主动来找你。' },
  { sel: '[data-tour="ai-chat"]',      title: '随时问邻邻',   desc: 'AI 客服帮你答疑、找服务、提交建议或举报。' },
]

interface Rect { top: number; left: number; width: number; height: number }

export default function Onboarding() {
  const { pathname } = useLocation()
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  // Desktop replay dot appears once the first tour is done/skipped.
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) === 'true' } catch { return false }
  })

  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

  // Resolve the current step's element → viewport rect. Returns null if missing.
  const measure = useCallback((idx: number): Rect | null => {
    const el = document.querySelector(STEPS[idx]?.sel) as HTMLElement | null
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  }, [])

  // Find the next step index (from `from`, inclusive) whose element exists.
  const nextExisting = useCallback((from: number): number => {
    for (let i = from; i < STEPS.length; i++) if (measure(i)) return i
    return -1
  }, [measure])

  const finish = useCallback(() => {
    setRunning(false)
    setRect(null)
    try { localStorage.setItem(SEEN_KEY, 'true') } catch { /* ignore */ }
    setSeen(true)
  }, [])

  const start = useCallback(() => {
    const first = nextExisting(0)
    if (first < 0) return
    setStep(first)
    setRunning(true)
  }, [nextExisting])

  // Auto-start for first-time visitors, only on the home page (targets live there).
  useEffect(() => {
    if (seen || running || pathname !== '/') return
    // Wait a beat for the home page to paint before measuring.
    const t = window.setTimeout(() => { if (nextExisting(0) >= 0) start() }, 900)
    return () => window.clearTimeout(t)
  }, [seen, running, pathname, nextExisting, start])

  // Scroll the target into view, then measure (and keep measuring on scroll/resize).
  useEffect(() => {
    if (!running) return
    const el = document.querySelector(STEPS[step]?.sel) as HTMLElement | null
    if (!el) { advance(); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const update = () => setRect(measure(step))
    const t = window.setTimeout(update, 320)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, step])

  function advance() {
    const nxt = nextExisting(step + 1)
    if (nxt < 0) finish()
    else setStep(nxt)
  }

  // ── Replay dot (desktop only, after first run) ──
  const replayDot = isDesktop && seen && !running && pathname === '/' ? (
    <button
      onClick={start}
      aria-label="再看一次新手引导"
      className="fixed bottom-3 right-3 z-[130] w-9 h-9 rounded-full bg-black/20 hover:bg-black/40
                 backdrop-blur text-white flex items-center justify-center transition-colors shadow-md"
      title="再来一次新手引导"
    >
      <Sparkles size={16} />
    </button>
  ) : null

  if (!running || !rect) {
    return replayDot ? createPortal(replayDot, document.body) : null
  }

  const s = STEPS[step]
  const vw = window.innerWidth, vh = window.innerHeight
  const spotTop = rect.top - PAD, spotLeft = rect.left - PAD
  const spotW = rect.width + PAD * 2, spotH = rect.height + PAD * 2

  // Tooltip: below the spotlight if room, else above.
  const below = spotTop + spotH + 170 < vh
  const tipTop = below ? spotTop + spotH + 14 : spotTop - 14
  const tipLeftRaw = rect.left + rect.width / 2 - 150
  const tipLeft = Math.max(12, Math.min(tipLeftRaw, vw - 312))
  const stepNum = step + 1

  const overlay = (
    <div className="fixed inset-0 z-[140]">
      {/* Click catcher — tap anywhere (outside the tooltip) to advance */}
      <div className="absolute inset-0" onClick={advance} />

      {/* Spotlight: box-shadow dims everything except this hole */}
      <motion.div
        initial={false}
        animate={{ top: spotTop, left: spotLeft, width: spotW, height: spotH }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="absolute rounded-2xl ring-2 ring-white/90 pointer-events-none"
        style={{ boxShadow: '0 0 0 9999px rgba(15,23,42,0.72)' }}
      />

      {/* Arrow pointing at the target */}
      <div
        className="absolute w-0 h-0 pointer-events-none"
        style={{
          left: Math.max(20, Math.min(rect.left + rect.width / 2 - 8, vw - 28)),
          top: below ? tipTop - 9 : tipTop - 1,
          borderLeft: '9px solid transparent',
          borderRight: '9px solid transparent',
          ...(below
            ? { borderBottom: '10px solid white' }
            : { borderTop: '10px solid white' }),
          transform: below ? 'none' : 'translateY(-100%)',
        }}
      />

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: below ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute w-[300px] bg-white rounded-2xl shadow-2xl p-4"
          style={{ left: tipLeft, top: below ? tipTop : tipTop, transform: below ? 'none' : 'translateY(-100%)' }}
        >
          <div className="flex items-start gap-3">
            <Mascot pose="curious" size={44} className="flex-shrink-0 -mt-1" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900">{s.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed mt-1">{s.desc}</p>
            </div>
            <button onClick={finish} aria-label="跳过" className="text-gray-300 hover:text-gray-500 -mr-1 -mt-1">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] text-gray-400">{stepNum} / {STEPS.length}</span>
            <div className="flex items-center gap-2">
              <button onClick={finish} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">跳过</button>
              <button onClick={advance}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold
                           px-4 py-1.5 rounded-xl transition-colors">
                {nextExisting(step + 1) < 0 ? '完成 🎉' : <>下一步 <ArrowRight size={13} /></>}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )

  return createPortal(overlay, document.body)
}
