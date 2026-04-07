// ─── Section Tabs ──────────────────────────────────────────────────────────────
// Horizontal tab bar that sits between the search bar and category grid.
// "找服务" is live; other sections show a "即将上线" placeholder.
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export type SectionTab = 'services' | 'jobs' | 'secondhand' | 'realestate' | 'events' | 'community'

interface Tab {
  id:       SectionTab
  label:    string
  emoji:    string
  live:     boolean
  sublabel: string
  href?:    string   // if set, navigate to this path instead of calling onChange
}

const TABS: Tab[] = [
  { id: 'services',    label: '找服务',  emoji: '🔧', live: true,  sublabel: '家政·搬家·装修', href: '/?from=tabs' },
  { id: 'jobs',        label: '招聘求职', emoji: '💼', live: true,  sublabel: '兼职·全职·现金工', href: '/jobs' },
  { id: 'secondhand',  label: '二手交易', emoji: '🛒', live: true,  sublabel: '家具·电子·服饰', href: '/secondhand' },
  { id: 'realestate',  label: '租房买房', emoji: '🏠', live: true,  sublabel: '出租·出售·合租', href: '/realestate' },
  { id: 'events',      label: '同城活动', emoji: '🎉', live: true,  sublabel: '聚会·展览·课程', href: '/events' },
  { id: 'community',   label: '社区圈子', emoji: '🏘️', live: true,  sublabel: '问答·推荐·分享', href: '/community' },
]

interface Props {
  active:             SectionTab
  onChange:           (tab: SectionTab) => void
  containerClassName?: string
}

export default function SectionTabs({ active, onChange, containerClassName }: Props) {
  const [toastTab, setToastTab] = useState<SectionTab | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate  = useNavigate()

  // Scroll active tab into view on mount (keeps position when navigating between pages)
  useEffect(() => {
    if (!scrollRef.current) return
    const activeBtn = scrollRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' })
    }
  }, [active])

  function handleClick(tab: Tab) {
    if (!tab.live) {
      setToastTab(tab.id)
      setTimeout(() => setToastTab(null), 2000)
      return
    }
    if (tab.href) {
      navigate(tab.href)
      return
    }
    onChange(tab.id)
  }

  return (
    <div className="relative">
      {/* Scrollable tab strip */}
      <div
        ref={scrollRef}
        className={`flex gap-1 overflow-x-auto scrollbar-hide border-b border-gray-100 ${containerClassName ?? 'px-4'}`}
        style={{ scrollbarWidth: 'none' }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              data-active={isActive}
              onClick={() => handleClick(tab)}
              className={`relative flex-shrink-0 flex items-center gap-1.5 md:gap-2.5
                          px-3 py-2 md:px-4 md:py-2.5
                          text-sm
                          font-medium transition-colors whitespace-nowrap
                          ${isActive
                            ? 'text-primary-600'
                            : tab.live
                              ? 'text-gray-500 hover:text-gray-800'
                              : 'text-gray-400 hover:text-gray-500'
                          }`}
            >
              <span className="text-lg md:text-2xl leading-none">{tab.emoji}</span>
              <span>{tab.label}</span>
              {!tab.live && (
                <span className="text-[9px] font-semibold text-amber-500 bg-amber-50
                                 px-1 py-0.5 rounded-full leading-none border border-amber-200">
                  即将上线
                </span>
              )}

              {/* Active underline */}
              {isActive && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Coming soon toast */}
      <AnimatePresence>
        {toastTab && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-14 left-1/2 -translate-x-1/2 z-50
                       bg-gray-800 text-white text-xs font-medium px-4 py-2
                       rounded-full shadow-lg whitespace-nowrap"
          >
            {TABS.find(t => t.id === toastTab)?.label} 板块即将上线，敬请期待 ✨
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
