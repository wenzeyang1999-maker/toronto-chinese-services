// ─── SaveButton ───────────────────────────────────────────────────────────────
// Reusable heart button. Loads saves once per session, then uses the store.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSavesStore } from '../../store/savesStore'

type TargetType = 'service' | 'job' | 'property' | 'secondhand' | 'event'

interface Props {
  type:  TargetType
  id:    string
  size?: number
  className?: string
}

export default function SaveButton({ type, id, size = 20, className = '' }: Props) {
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)
  const { fetchSaves, isSaved, toggleSave, isReady } = useSavesStore()

  // Ensure saves are loaded when user is present
  useEffect(() => {
    if (user && !isReady) {
      fetchSaves(user.id)
    }
  }, [user?.id, isReady])

  const saved = user ? isSaved(type, id) : false

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    await toggleSave(user.id, type, id)
  }

  return (
    <button
      onClick={handleClick}
      aria-label={saved ? '取消收藏' : '收藏'}
      className={`flex items-center justify-center rounded-full transition-all active:scale-90 ${className}`}
    >
      <Heart
        size={size}
        className={`transition-colors ${
          saved
            ? 'fill-red-500 text-red-500'
            : 'text-gray-400 hover:text-red-400'
        }`}
      />
    </button>
  )
}
