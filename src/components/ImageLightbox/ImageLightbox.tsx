// ─── ImageLightbox ────────────────────────────────────────────────────────────
// Fullscreen image viewer (小红书-style). Controlled: pass the open index (or
// null to close). Supports multi-image swipe / arrow / keyboard navigation.
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  images: string[]
  openIndex: number | null
  onClose: () => void
}

export default function ImageLightbox({ images, openIndex, onClose }: Props) {
  const [index, setIndex] = useState(openIndex ?? 0)
  const [startX, setStartX] = useState<number | null>(null)

  useEffect(() => {
    if (openIndex != null) setIndex(openIndex)
  }, [openIndex])

  const many = images.length > 1
  const prev = useCallback(() => setIndex((i) => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setIndex((i) => (i + 1) % images.length), [images.length])

  useEffect(() => {
    if (openIndex == null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    // lock body scroll while open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [openIndex, onClose, prev, next])

  return createPortal(
    <AnimatePresence>
      {openIndex != null && (
        <motion.div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center select-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          onTouchStart={(e) => setStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (startX == null || !many) return
            const dx = e.changedTouches[0].clientX - startX
            if (dx > 50) prev()
            else if (dx < -50) next()
            setStartX(null)
          }}
        >
          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur-sm"
            aria-label="关闭"
          >
            <X size={20} />
          </button>

          {/* Counter */}
          {many && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[110] text-white/90 text-sm font-medium">
              {index + 1} / {images.length}
            </div>
          )}

          {/* Prev / Next */}
          {many && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev() }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-[110] w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur-sm"
                aria-label="上一张"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-[110] w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur-sm"
                aria-label="下一张"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Image */}
          <motion.img
            key={index}
            src={images[index]}
            alt=""
            initial={{ opacity: 0.4, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
