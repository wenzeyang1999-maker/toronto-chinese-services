// ─── HeroCarousel ─────────────────────────────────────────────────────────────
// Full-viewport image/video slider shown on the Home page.
//
// HOW TO SWAP SLIDES:
//   Edit the SLIDES array below. Each slide needs:
//     type : 'image' | 'video'
//     src  : path under /public (e.g. '/images/slides/my-photo.jpg')
//            or a remote URL
//     title / subtitle : text shown in the semi-transparent overlay
//
// INTERACTIONS (all trigger a smooth scroll past the carousel):
//   • Click anywhere on the image
//   • Mouse wheel scroll down
//   • Mobile swipe up
//   Clicking the dot indicators only switches slides (no scroll).
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

// ── Slide data ────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    type: 'image' as const,
    src: '/images/slides/slide1.svg',
    title: '多伦多华人一站式服务',
    subtitle: '搬家、保洁、接送、装修，一键找到靠谱服务',
  },
  {
    type: 'image' as const,
    src: '/images/slides/slide2.svg',
    title: '日常事务，一键搞定',
    subtitle: '海外生活不孤单，华人服务就在身边',
  },
  {
    type: 'image' as const,
    src: '/images/slides/slide3.svg',
    title: '有技能？来接单',
    subtitle: '免费发布服务，让附近客户轻松找到你',
  },
]

const INTERVAL_MS = 5000   // Auto-slide interval in ms
const NAV_HEIGHT  = 56     // Must match HeroBanner h-14 (px)

// Smooth scroll so the section below the carousel sits just under the nav bar
const scrollPast = () => {
  window.scrollTo({ top: window.innerHeight - NAV_HEIGHT, behavior: 'smooth' })
}

export default function HeroCarousel() {
  const [current, setCurrent]       = useState(0)
  const [direction, setDirection]   = useState(1)
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartY                 = useRef<number>(0)
  const wheelLocked                 = useRef(false)

  const goTo = (index: number, dir: number) => {
    setDirection(dir)
    setCurrent(index)
  }

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCurrent((prev) => { setDirection(1); return (prev + 1) % SLIDES.length })
    }, INTERVAL_MS)
  }

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  useEffect(() => { startTimer(); return stopTimer }, [])

  // ── Interaction handlers ───────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY > 0 && !wheelLocked.current) {
      wheelLocked.current = true
      scrollPast()
      setTimeout(() => { wheelLocked.current = false }, 1000)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY
    if (delta > 30) scrollPast() // finger moved up = intent to scroll down
  }

  // ── Slide transition variants ──────────────────────────────────────────────
  const variants = {
    enter:  (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  const slide = SLIDES[current]

  return (
    <div
      className="relative w-full overflow-hidden cursor-pointer"
      style={{ height: 'calc(100vh - 56px)' }}
      onMouseEnter={stopTimer}
      onMouseLeave={startTimer}
      onClick={scrollPast}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides */}
      <AnimatePresence custom={direction} initial={false}>
        <motion.div
          key={current}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {/* Media layer — swap src/type in SLIDES above */}
          {slide.type === 'video' ? (
            <video src={slide.src} autoPlay muted loop playsInline className="w-full h-full object-cover" />
          ) : (
            <img src={slide.src} alt={slide.title} className="w-full h-full object-cover" />
          )}

          {/* Semi-transparent overlay */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Text overlay */}
          <div className="absolute inset-0 flex flex-col justify-center px-10">
            <motion.h2
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.45 }}
              className="text-white text-3xl font-bold mb-3 drop-shadow"
            >
              {slide.title}
            </motion.h2>
            <motion.p
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.45 }}
              className="text-white/80 text-base drop-shadow"
            >
              {slide.subtitle}
            </motion.p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dot indicators — stopPropagation prevents triggering scrollPast */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); goTo(i, i > current ? 1 : -1) }}
            className={`rounded-full transition-all duration-300 ${
              i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50'
            }`}
          />
        ))}
      </div>

      {/* Bouncing down arrow — hints user to scroll */}
      <motion.div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/60"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
      >
        <ChevronDown size={20} />
      </motion.div>
    </div>
  )
}
