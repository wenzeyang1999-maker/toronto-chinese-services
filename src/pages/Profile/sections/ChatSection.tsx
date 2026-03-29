import { motion } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import type { ChatSession } from '../types'

interface Props {
  sessions: ChatSession[]
  onClear:  () => void
}

export default function ChatSection({ sessions, onClear }: Props) {
  return (
    <motion.div
      key="chat"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
      className="flex-1 px-4 py-6 max-w-md lg:max-w-none mx-auto w-full"
    >
      {sessions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
          <MessageSquare size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">暂无 AI 对话记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">历史对话</span>
            <button onClick={onClear} className="text-xs text-gray-400 hover:text-red-500">清空</button>
          </div>
          <div className="divide-y divide-gray-50">
            {sessions.map(session => (
              <div key={session.id} className="px-5 py-4">
                <p className="text-sm text-gray-800 truncate">{session.preview}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {session.count} 条消息 · {new Date(session.ts).toLocaleDateString('zh-CN')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
