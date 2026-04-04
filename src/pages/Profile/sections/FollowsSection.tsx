// ─── Follows Section (我的关注) ───────────────────────────────────────────────
// Shows the list of providers the current user follows.
// Each row links to the provider's public profile.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { UserCheck, UserMinus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useFollowsStore } from '../../../store/followsStore'

interface FollowedProvider {
  id:         string
  name:       string
  avatar_url: string | null
  bio:        string | null
  followed_at: string
}

export default function FollowsSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { toggleFollow } = useFollowsStore()

  const [providers, setProviders] = useState<FollowedProvider[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!user) return
    load()
  }, [user?.id])

  async function load() {
    if (!user) return
    setLoading(true)

    const { data } = await supabase
      .from('follows')
      .select('provider_id, created_at')
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) { setProviders([]); setLoading(false); return }

    const ids = data.map((r: any) => r.provider_id)
    const followedAt: Record<string, string> = {}
    data.forEach((r: any) => { followedAt[r.provider_id] = r.created_at })

    const { data: users } = await supabase
      .from('users')
      .select('id, name, avatar_url, bio')
      .in('id', ids)

    const mapped: FollowedProvider[] = (users ?? []).map((u: any) => ({
      id:          u.id,
      name:        u.name,
      avatar_url:  u.avatar_url,
      bio:         u.bio,
      followed_at: followedAt[u.id] ?? '',
    }))

    // Preserve original follow order (newest first)
    mapped.sort((a, b) => new Date(b.followed_at).getTime() - new Date(a.followed_at).getTime())

    setProviders(mapped)
    setLoading(false)
  }

  async function handleUnfollow(p: FollowedProvider) {
    if (!user) return
    await toggleFollow(user.id, p.id)
    setProviders(prev => prev.filter(x => x.id !== p.id))
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">加载中…</div>
  )

  return (
    <div className="flex-1 px-4 py-5 max-w-md lg:max-w-none mx-auto w-full">
      <div className="flex items-center gap-2 mb-4">
        <UserCheck size={16} className="text-primary-500" />
        <span className="text-sm font-semibold text-gray-700">我的关注</span>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{providers.length}</span>
      </div>

      {providers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <UserCheck size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">还没有关注任何服务商</p>
          <p className="text-xs text-gray-300 mt-1">在服务商主页点击「关注」即可</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {providers.map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ delay: i * 0.03 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-4 py-3.5"
              >
                {/* Avatar */}
                <button onClick={() => navigate(`/provider/${p.id}`)} className="flex-shrink-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={p.name}
                      className="w-11 h-11 rounded-full object-cover border border-gray-100" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                    flex items-center justify-center text-white font-bold text-base">
                      {p.name.charAt(0)}
                    </div>
                  )}
                </button>

                {/* Info */}
                <button onClick={() => navigate(`/provider/${p.id}`)}
                  className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                  {p.bio ? (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{p.bio}</p>
                  ) : (
                    <p className="text-xs text-gray-300 mt-0.5">关注于 {p.followed_at.slice(0, 10)}</p>
                  )}
                </button>

                {/* Unfollow */}
                <button onClick={() => handleUnfollow(p)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-300
                             hover:bg-red-50 hover:text-red-400 transition-colors flex-shrink-0"
                  title="取消关注"
                >
                  <UserMinus size={15} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
