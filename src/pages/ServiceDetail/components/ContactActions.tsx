import { MessageSquare, Phone, UserRound, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  isOpen: boolean
  providerName: string
  phone?: string
  wechat?: string
  onClose: () => void
  onMessage: () => void
  onCall: () => void
  onCopyWechat: () => void
  onOpenProfile: () => void
}

export default function ContactActions({
  isOpen,
  providerName,
  phone,
  wechat,
  onClose,
  onMessage,
  onCall,
  onCopyWechat,
  onOpenProfile,
}: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="fixed inset-x-0 bottom-24 z-40 px-4"
        >
          <div className="mx-auto max-w-2xl rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">联系 {providerName}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">选择你最方便的方式，优先推荐站内消息，方便继续跟进。</p>
              </div>
              <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={onMessage}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700"
              >
                <MessageSquare size={16} />
                站内消息
              </button>
              <button
                onClick={onOpenProfile}
                className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <UserRound size={16} />
                查看主页
              </button>
              {wechat && (
                <button
                  onClick={onCopyWechat}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <span className="text-base">💬</span>
                  复制微信号
                </button>
              )}
              {phone && (
                <button
                  onClick={onCall}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <Phone size={16} />
                  电话联系
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
