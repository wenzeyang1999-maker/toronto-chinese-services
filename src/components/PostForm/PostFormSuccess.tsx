import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'

interface Props {
  title: string
  subtitle: string
  viewListLabel: string
  onViewList: () => void
  postAnotherLabel: string
  onPostAnother: () => void
}

export default function PostFormSuccess({
  title, subtitle, viewListLabel, onViewList, postAnotherLabel, onPostAnother,
}: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center max-w-sm w-full"
      >
        <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{subtitle}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onViewList}
            className="w-full bg-primary-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-primary-700 transition-colors"
          >
            {viewListLabel}
          </button>
          <button
            onClick={onPostAnother}
            className="w-full border border-gray-200 text-gray-600 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            {postAnotherLabel}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
