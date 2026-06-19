import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { toast } from '../../../lib/toast'

interface Props {
  newServiceId: string | null
  onGoHome: () => void
  onContinue: () => void
}

export default function SuccessScreen({ newServiceId, onGoHome, onContinue }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="text-center"
      >
        <CheckCircle size={72} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">发布成功！</h2>
        <p className="text-gray-500 mb-6">您的服务已发布，附近的客户可以找到您了</p>
        {newServiceId && (
          <button
            onClick={async () => {
              const url = `${window.location.origin}/service/${newServiceId}`
              if (navigator.share) {
                await navigator.share({ title: '我在 TCS 发布了新服务', url }).catch(() => {})
              } else {
                await navigator.clipboard.writeText(url).catch(() => {})
                toast('链接已复制，可分享到微信', 'success')
              }
            }}
            className="w-full flex items-center justify-center gap-2 mb-3 py-3 bg-green-50
                       border border-green-200 text-green-700 font-semibold rounded-2xl
                       text-sm hover:bg-green-100 transition-colors"
          >
            📤 分享给朋友
          </button>
        )}
        <div className="flex flex-col gap-3">
          <button onClick={onGoHome} className="btn-primary">
            返回首页
          </button>
          <button onClick={onContinue} className="text-gray-500 text-sm underline">
            继续发布服务
          </button>
        </div>
      </motion.div>
    </div>
  )
}
