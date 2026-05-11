import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface Props { grouped?: boolean }

export default function PostServiceFAB({ grouped }: Props) {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const btn = (
    <button
      onClick={() => user ? navigate('/post') : navigate('/login', { state: { from: '/post' } })}
      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700
                 text-white rounded-full shadow-lg px-4 py-3
                 active:scale-95 transition-all duration-200 text-sm font-semibold whitespace-nowrap"
    >
      <Plus size={20} strokeWidth={2.5} />
      发布服务
    </button>
  )

  if (grouped) return btn

  return (
    <div className="fixed bottom-64 right-5 lg:bottom-44 lg:right-16 z-50">
      {btn}
    </div>
  )
}
