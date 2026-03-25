import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'

export default function LoadingScreen() {
  const setLoadingDone = useAppStore((s) => s.setLoadingDone)
  const isLoadingDone = useAppStore((s) => s.isLoadingDone)
  const [progress, setProgress] = useState(0)
  const [canSkip, setCanSkip] = useState(false)

  useEffect(() => {
    const start = Date.now()
    const duration = 2800

    // Show skip button after 800ms
    const skipTimer = setTimeout(() => setCanSkip(true), 800)

    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const p = Math.min((elapsed / duration) * 100, 100)
      setProgress(p)
      if (p >= 100) {
        clearInterval(interval)
        setTimeout(() => setLoadingDone(), 300)
      }
    }, 30)

    return () => {
      clearInterval(interval)
      clearTimeout(skipTimer)
    }
  }, [setLoadingDone])

  if (isLoadingDone) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900"
      >
        {/* Main text */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="flex flex-col items-center text-center px-8 mb-16"
        >
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-white text-4xl font-bold leading-tight mb-4"
          >
            日常事务，一键搞定
          </motion.h1>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="text-blue-100 text-sm leading-relaxed"
          >
            多伦多华人一站式生活服务平台，让您的海外生活更加便利。
          </motion.p>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-48 bg-white/20 rounded-full h-1 overflow-hidden mb-4"
        >
          <motion.div
            className="h-full bg-white rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.05 }}
          />
        </motion.div>

        {/* Skip button */}
        <AnimatePresence>
          {canSkip && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => setLoadingDone()}
              className="text-white/60 text-xs mt-6 hover:text-white transition-colors"
            >
              跳过 →
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
