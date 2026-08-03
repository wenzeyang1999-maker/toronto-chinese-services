// ─── Onboarding / 新手引导（聚光灯式，多页） ───────────────────────────────────
// Highlights real UI elements one-by-one: dims everything else, spotlights the
// target, points an arrow at it, explains it. Route-aware — a separate tour for
// the home page and for「我的」(profile). First visit to each runs automatically;
// on desktop a small semi-transparent replay dot (bottom-left) re-runs the tour
// for the current page. Steps whose element is missing are skipped.
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, Sparkles } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import Mascot from '../Mascot/Mascot'

const PAD = 8  // spotlight padding around target

interface Step { sel: string; title: string; desc: string }
interface Tour { key: string; steps: Step[] }

const HOME_STEPS: Step[] = [
  { sel: '[data-tour="search"]',       title: '搜本地服务',   desc: '一句话搜你要的师傅或商家，附近结果优先展示。' },
  { sel: '[data-tour="ai-match"]',     title: 'AI 帮你找',    desc: '懒得逐个找？描述需求，AI 自动把单派给最近的几家商户，坐等联系。' },
  { sel: '[data-tour="categories"]',   title: '热门服务直达', desc: '搬家、保洁、接送、维修… 常用类目一键进入。' },
  { sel: '[data-tour="map"]',          title: '地图找附近',   desc: '看谁正在附近实时在线接单，就近直接联系。' },
  { sel: '[data-tour="post-request"]', title: '发布需求',     desc: '把需求发出去，让附近商家主动来找你。' },
  { sel: '[data-tour="ai-chat"]',      title: '随时问邻邻',   desc: 'AI 客服帮你答疑、找服务、提交建议或举报。' },
]

const PROFILE_STEPS: Step[] = [
  { sel: '[data-tour="p-role"]',          title: '一键切换身份', desc: '客户找服务，或翻转成「服务商」就上线接单、显示到地图上。' },
  { sel: '[data-tour="p-homepage"]',      title: '装修你的名片', desc: '填简介、传资质、加技能标签，让客户和商家更了解你。' },
  { sel: '[data-tour="p-services"]',      title: '我的发布',     desc: '你发布的服务、招聘、房源、闲置、活动、帖子都在这里管理。' },
  { sel: '[data-tour="p-transactions"]',  title: '我的交易',     desc: '需求、接单、成交记录一站查看。' },
  { sel: '[data-tour="p-verification"]',  title: '联系方式与认证', desc: '绑定联系方式、完成认证，更容易获得信任和曝光。' },
]

const TOURS: Record<string, Tour> = {
  '/':        { key: 'tcs_onboarded_v2',         steps: HOME_STEPS },
  '/profile': { key: 'tcs_onboarded_profile_v1', steps: PROFILE_STEPS },
}

interface Rect { top: number; left: number; width: number; height: number }

export default function Onboarding() {
  const { pathname } = useLocation()
  const tour = TOURS[pathname]
  const steps = tour?.steps ?? []

  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [tick, setTick] = useState(0)   // bump to re-read localStorage after finishing

  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  const seen = tour ? (() => { try { return localStorage.getItem(tour.key) === 'true' } catch { return true } })() : true

  const measure = useCallback((idx: number): Rect | null => {
    const el = document.querySelector(steps[idx]?.sel) as HTMLElement | null
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  }, [steps])

  const nextExisting = useCallback((from: number): number => {
    for (let i = from; i < steps.length; i++) if (measure(i)) return i
    return -1
  }, [measure, steps.length])

  const finish = useCallback(() => {
    setRunning(false)
    setRect(null)
    if (tour) { try { localStorage.setItem(tour.key, 'true') } catch { /* ignore */ } }
    setTick(t => t + 1)
  }, [tour])

  const start = useCallback(() => {
    const first = nextExisting(0)
    if (first < 0) return
    setStep(first)
    setRunning(true)
  }, [nextExisting])

  // Reset any running tour when the route changes.
  useEffect(() => { setRunning(false); setRect(null); setStep(0) }, [pathname])

  // Auto-start for first-time visitors of a tour-enabled route.
  useEffect(() => {
    if (!tour || seen || running) return
    const t = window.setTimeout(() => { if (nextExisting(0) >= 0) start() }, 900)
    return () => window.clearTimeout(t)
  }, [tour, seen, running, nextExisting, start, tick])

  // Scroll target into view, then measure (keep updating on scroll/resize).
  useEffect(() => {
    if (!running) return
    const el = document.querySelector(steps[step]?.sel) as HTMLElement | null
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

  // Replay dot — desktop only, after this route's tour was seen (bottom-left).
  const replayDot = isDesktop && tour && seen && !running ? (
    <button
      onClick={start}
      aria-label="再看一次新手引导"
      title="再来一次新手引导"
      className="fixed bottom-3 left-3 z-[130] w-9 h-9 rounded-full bg-black/20 hover:bg-black/40
                 backdrop-blur text-white flex items-center justify-center transition-colors shadow-md"
    >
      <Sparkles size={16} />
    </button>
  ) : null

  if (!running || !rect) {
    return replayDot ? createPortal(replayDot, document.body) : null
  }

  const s = steps[step]
  const vw = window.innerWidth, vh = window.innerHeight
  const spotTop = rect.top - PAD, spotLeft = rect.left - PAD
  const spotW = rect.width + PAD * 2, spotH = rect.height + PAD * 2

  const TIP_W = 300, TIP_H = 200
  const spotBottom = spotTop + spotH
  const below = spotBottom + 14 + TIP_H < vh - 12
  let tipTop = below ? spotBottom + 14 : spotTop - 14 - TIP_H
  tipTop = Math.max(12, Math.min(tipTop, vh - TIP_H - 12))
  const tipLeftRaw = rect.left + rect.width / 2 - TIP_W / 2
  const tipLeft = Math.max(12, Math.min(tipLeftRaw, vw - TIP_W - 12))
  const arrowX = Math.max(16, Math.min(rect.left + rect.width / 2 - tipLeft - 9, TIP_W - 34))
  const stepNum = step + 1

  const overlay = (
    <div className="fixed inset-0 z-[140]">
      <div className="absolute inset-0" onClick={advance} />

      {/* Spotlight */}
      <motion.div
        initial={false}
        animate={{ top: spotTop, left: spotLeft, width: spotW, height: spotH }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="absolute rounded-2xl ring-2 ring-white/90 pointer-events-none"
        style={{ boxShadow: '0 0 0 9999px rgba(15,23,42,0.72)' }}
      />

      {/* Tooltip (arrow attached to its edge) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${pathname}-${step}`}
          initial={{ opacity: 0, y: below ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute w-[300px] bg-white rounded-2xl shadow-2xl p-4"
          style={{ left: tipLeft, top: tipTop }}
        >
          <div
            className="absolute w-0 h-0"
            style={{
              left: arrowX,
              borderLeft: '9px solid transparent',
              borderRight: '9px solid transparent',
              ...(below ? { top: -9, borderBottom: '10px solid white' } : { bottom: -9, borderTop: '10px solid white' }),
            }}
          />
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
            <span className="text-[11px] text-gray-400">{stepNum} / {steps.length}</span>
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
