// ─── FollowButton ─────────────────────────────────────────────────────────────
// Displays 「关注」/「已关注」 button for a provider.
// Loads follow state on mount, supports optimistic toggle.
//
// Usage:
//   <FollowButton providerId={provider.id} />
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, UserCheck } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useFollowsStore } from '../../store/followsStore'

interface Props {
  providerId: string
  className?: string
}

export default function FollowButton({ providerId, className = '' }: Props) {
  const navigate       = useNavigate()
  const user           = useAuthStore((s) => s.user)
  const { fetchFollows, isFollowing, toggleFollow, isReady } = useFollowsStore()

  useEffect(() => {
    if (user && !isReady) fetchFollows(user.id)
  }, [user?.id, isReady, fetchFollows])

  // Don't show button on own profile
  if (user?.id === providerId) return null

  const followed = user ? isFollowing(providerId) : false

  async function handleClick() {
    if (!user) { navigate('/login'); return }
    await toggleFollow(user.id, providerId)
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95 ${
        followed
          ? 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500'
          : 'bg-primary-600 text-white hover:bg-primary-700'
      } ${className}`}
    >
      {followed
        ? <><UserCheck size={15} />已关注</>
        : <><UserPlus  size={15} />关注</>
      }
    </button>
  )
}
