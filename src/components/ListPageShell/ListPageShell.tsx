import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '../Header/Header'
import PostFAB from '../PostFAB/PostFAB'
import PageMeta from '../PageMeta/PageMeta'
import PullIndicator from '../PullToRefresh/PullIndicator'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'

interface Props {
  pageTitle: string
  pageDescription: string
  topBar: React.ReactNode
  countText: string
  selectedId: string | null
  mobileOpen?: boolean
  onCloseMobile?: () => void
  /** Content shown in the desktop right panel */
  detailDesktop: React.ReactNode | null
  /** Content shown in the mobile bottom drawer (often same component, different onClose) */
  detailMobile?: React.ReactNode | null
  /** Width of the left masonry column when detail is open (default 380) */
  leftColWidth?: number
  /** Shown in the right panel on desktop when nothing is selected */
  rightPlaceholder?: React.ReactNode
  children: React.ReactNode
  fabPath?: string | null
  /** When set, the FAB renders as a labelled pill instead of a bare「+」circle */
  fabLabel?: string
  /** When provided, enables pull-to-refresh on the mobile list column */
  onRefresh?: () => Promise<unknown> | void
}

export default function ListPageShell({
  pageTitle,
  pageDescription,
  topBar,
  countText,
  selectedId,
  mobileOpen = false,
  onCloseMobile,
  detailDesktop,
  detailMobile,
  leftColWidth = 380,
  rightPlaceholder,
  children,
  fabPath,
  fabLabel,
  onRefresh,
}: Props) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const detailRef = useRef<HTMLDivElement>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const { distance, refreshing, threshold } = usePullToRefresh(
    onRefresh ?? (() => {}),
    listScrollRef,
    !!onRefresh,
  )

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <PageMeta title={pageTitle} description={pageDescription} />
      <Header />

      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 py-3 flex-shrink-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto space-y-3">
          {topBar}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto flex gap-0 py-3">

        {/* Left column */}
        <div
          className={`flex flex-col overflow-hidden ${
            selectedId && detailDesktop
              ? 'hidden lg:flex lg:flex-shrink-0'
              : 'w-full'
          }`}
          style={selectedId && detailDesktop ? { width: leftColWidth } : undefined}
        >
          <p className="text-xs text-gray-400 mb-2 flex-shrink-0">{countText}</p>
          <div className="relative flex-1 overflow-hidden">
            {onRefresh && (
              <PullIndicator distance={distance} refreshing={refreshing} threshold={threshold} />
            )}
            <div
              ref={listScrollRef}
              className="h-full overflow-y-auto pr-0.5"
              style={onRefresh ? {
                transform: `translateY(${distance}px)`,
                transition: distance === 0 ? 'transform 0.2s' : 'none',
              } : undefined}
            >
              {children}
            </div>
          </div>
        </div>

        {/* Right: detail panel (desktop) */}
        <AnimatePresence mode="wait">
          {selectedId && detailDesktop ? (
            <motion.div
              key={selectedId}
              ref={detailRef}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="hidden lg:flex flex-col flex-1 overflow-y-auto ml-4"
            >
              {detailDesktop}
            </motion.div>
          ) : rightPlaceholder ? (
            <div className="hidden lg:flex flex-1 items-center justify-center ml-4">
              {rightPlaceholder}
            </div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Mobile bottom drawer */}
      <AnimatePresence>
        {mobileOpen && (detailMobile ?? detailDesktop) && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
          >
            <div className="absolute inset-0 bg-black/40" />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              {detailMobile ?? detailDesktop}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      {user && fabPath && <PostFAB onClick={() => navigate(fabPath)} label={fabLabel} />}
    </div>
  )
}
