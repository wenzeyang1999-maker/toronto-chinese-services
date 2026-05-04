import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useToastStore } from '../../lib/toast'

export default function ToastContainer() {
  const { items, remove } = useToastStore()

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {items.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,   scale: 1 }}
            exit={{    opacity: 0, y: -6,   scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium ${
              t.type === 'success' ? 'bg-green-500 text-white' :
              t.type === 'error'   ? 'bg-red-500 text-white'   :
                                     'bg-gray-900 text-white'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 size={16} className="flex-shrink-0" /> :
             t.type === 'error'   ? <AlertCircle  size={16} className="flex-shrink-0" /> :
                                    <Info         size={16} className="flex-shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
