// ─── Community Page ───────────────────────────────────────────────────────────
// Route: /community
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PenSquare, MessageCircle, Heart, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Header from '../../components/Header/Header'
import SectionTabs from '../../components/SectionTabs/SectionTabs'

// ── Config ────────────────────────────────────────────────────────────────────

export const POST_TYPE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  recommend:   { label: '求推荐', emoji: '🙏', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  experience:  { label: '经验分享', emoji: '💡', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  question:    { label: '问个问题', emoji: '❓', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  secondhand:  { label: '随手转让', emoji: '🛍️', color: 'bg-green-50 text-green-600 border-green-200' },
}

export const AREA_CONFIG: Record<string, string> = {
  north_york:   'North York',
  markham:      'Markham',
  mississauga:  'Mississauga',
  scarborough:  'Scarborough',
  downtown:     'Downtown',
  brampton:     'Brampton',
  other:        '其他地区',
}

interface Post {
  id: string
  title: string
  content: string
  type: string
  area: string
  like_count: number
  created_at: string
  author: { id: string; name: string; avatar_url: string | null } | null
  comment_count: number
}

export default function CommunityPage() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)

  const [posts,       setPosts]       = useState<Post[]>([])
  const [loading,     setLoading]     = useState(true)
  const [typeFilter,  setTypeFilter]  = useState<string>('all')
  const [areaFilter,  setAreaFilter]  = useState<string>('all')

  useEffect(() => { load() }, [typeFilter, areaFilter])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('community_posts')
      .select('id, title, content, type, area, like_count, created_at, author:author_id(id, name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (typeFilter !== 'all') q = q.eq('type', typeFilter)
    if (areaFilter !== 'all') q = q.eq('area', areaFilter)

    const { data } = await q
    if (!data) { setLoading(false); return }

    const ids = data.map((p: any) => p.id)
    const { data: counts } = await supabase
      .from('community_comments')
      .select('post_id')
      .in('post_id', ids)

    const countMap: Record<string, number> = {}
    counts?.forEach((c: any) => { countMap[c.post_id] = (countMap[c.post_id] ?? 0) + 1 })

    setPosts(data.map((p: any) => ({
      ...p,
      author:        Array.isArray(p.author) ? p.author[0] : p.author,
      comment_count: countMap[p.id] ?? 0,
    })))
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />

      {/* Section tabs — same as Jobs/Secondhand/Events */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          <SectionTabs active="community" onChange={() => {}} containerClassName="px-0" />
        </div>
      </div>

      {/* Filters + post button */}
      <div className="bg-white border-b border-gray-100">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto py-3 space-y-2.5">
          {/* Top row: type filters + 发帖 button */}
          <div className="flex items-center gap-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
              {[['all', '全部', '📋'], ...Object.entries(POST_TYPE_CONFIG).map(([k, v]) => [k, v.label, v.emoji])].map(([key, label, emoji]) => (
                <button key={key} onClick={() => setTypeFilter(key)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold
                              border transition-all ${typeFilter === key
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                  <span>{emoji}</span>{label}
                </button>
              ))}
            </div>
            {user && (
              <button onClick={() => navigate('/community/post')}
                className="flex-shrink-0 flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700
                           text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors">
                <PenSquare size={14} />
                发帖
              </button>
            )}
          </div>

          {/* Area filter */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[['all', '全部地区'], ...Object.entries(AREA_CONFIG)].map(([key, label]) => (
              <button key={key} onClick={() => setAreaFilter(key)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium
                            border transition-all ${areaFilter === key
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto pt-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-sm">还没有帖子，来发第一条吧</p>
            {user && (
              <button onClick={() => navigate('/community/post')}
                className="mt-4 text-primary-600 text-sm font-semibold hover:underline">
                立即发帖 →
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence>
            {posts.map((post, i) => {
              const tc = POST_TYPE_CONFIG[post.type]
              return (
                <motion.div key={post.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/community/${post.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer
                             hover:border-primary-200 hover:shadow-md transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {post.author?.avatar_url ? (
                      <img src={post.author.avatar_url} alt={post.author.name}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                      flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {post.author?.name?.charAt(0) ?? '?'}
                      </div>
                    )}
                    <span className="text-xs text-gray-500 font-medium">{post.author?.name ?? '匿名'}</span>
                    <span className={`ml-auto flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${tc?.color}`}>
                      {tc?.emoji} {tc?.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-800 mb-1 line-clamp-2">{post.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">{post.content}</p>

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                      📍 {AREA_CONFIG[post.area] ?? post.area}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={11} /> {post.comment_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart size={11} /> {post.like_count}
                    </span>
                    <span className="ml-auto">{post.created_at.slice(0, 10)}</span>
                    <ChevronRight size={13} className="text-gray-300" />
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
