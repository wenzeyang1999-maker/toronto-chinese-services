// ─── Community Page (瀑布流 / 小红书风格) ────────────────────────────────────
// Route: /community
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Header from '../../components/Header/Header'
import SectionTabs from '../../components/SectionTabs/SectionTabs'

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
  images: string[] | null
  author: { id: string; name: string; avatar_url: string | null } | null
  comment_count: number
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [posts,      setPosts]      = useState<Post[]>([])
  const [loading,    setLoading]    = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [areaFilter, setAreaFilter] = useState<string>('all')

  useEffect(() => { load() }, [typeFilter, areaFilter])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('community_posts')
      .select('id, title, content, type, area, like_count, created_at, images, author:author_id(id, name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (typeFilter !== 'all') q = q.eq('type', typeFilter)
    if (areaFilter !== 'all') q = q.eq('area', areaFilter)

    const { data } = await q
    if (!data) { setLoading(false); return }

    const ids = data.map((p: any) => p.id)
    const { data: counts } = await supabase
      .from('community_comments').select('post_id').in('post_id', ids)

    const countMap: Record<string, number> = {}
    counts?.forEach((c: any) => { countMap[c.post_id] = (countMap[c.post_id] ?? 0) + 1 })

    const mapped = data.map((p: any) => ({
      ...p,
      author:        Array.isArray(p.author) ? p.author[0] : p.author,
      comment_count: countMap[p.id] ?? 0,
    }))
    // Shuffle so feed looks different on each visit
    for (let i = mapped.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mapped[i], mapped[j]] = [mapped[j], mapped[i]]
    }
    setPosts(mapped)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />

      {/* Section tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          <SectionTabs active="community" onChange={() => {}} containerClassName="px-0" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto py-2.5 space-y-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
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
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[['all', '全部地区'], ...Object.entries(AREA_CONFIG)].map(([key, label]) => (
              <button key={key} onClick={() => setAreaFilter(key)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all
                            ${areaFilter === key
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FAB — 发帖 */}
      {user && (
        <button
          onClick={() => navigate('/community/post')}
          className="fixed bottom-8 left-5 z-30 flex items-center gap-2
                     bg-primary-600 hover:bg-primary-700 active:scale-95
                     text-white font-semibold rounded-full shadow-lg
                     px-4 py-3 transition-all"
        >
          <Plus size={18} />
          <span className="text-sm">发帖</span>
        </button>
      )}

      {/* Waterfall grid */}
      <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto pt-4">
        {loading ? (
          // Skeleton
          <div style={{ columns: '220px', columnGap: '10px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="break-inside-avoid mb-2.5 bg-white rounded-2xl overflow-hidden animate-pulse"
                style={{ height: i % 3 === 0 ? 240 : i % 3 === 1 ? 180 : 300 }}>
                <div className="w-full h-3/4 bg-gray-100" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-4/5" />
                  <div className="h-2.5 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
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
          // CSS columns = masonry without JS
          <div style={{ columns: '220px', columnGap: '10px' }}>
            {posts.map((post, i) => {
              const tc      = POST_TYPE_CONFIG[post.type]
              const hasImg  = (post.images?.length ?? 0) > 0
              const coverImg = post.images?.[0]

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/community/${post.id}`)}
                  className="break-inside-avoid mb-2.5 bg-white rounded-2xl overflow-hidden
                             cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                >
                  {/* Cover image */}
                  {hasImg && (
                    <img
                      src={coverImg}
                      alt={post.title}
                      loading="lazy"
                      className="w-full object-cover"
                      style={{ display: 'block' }}
                    />
                  )}

                  {/* No image — show type emoji as placeholder */}
                  {!hasImg && (
                    <div className="w-full py-6 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                      <span className="text-4xl opacity-60">{tc?.emoji ?? '💬'}</span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="px-3 pt-2 pb-3">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">
                      {post.title}
                    </p>
                    {!hasImg && (
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-2">
                        {post.content}
                      </p>
                    )}

                    {/* Author + likes */}
                    <div className="flex items-center gap-1.5">
                      {post.author?.avatar_url ? (
                        <img src={post.author.avatar_url} alt=""
                          className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                        flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                          {post.author?.name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <span className="text-[11px] text-gray-400 truncate flex-1">
                        {post.author?.name ?? '匿名'}
                      </span>
                      <span className="flex items-center gap-0.5 text-[11px] text-gray-400 flex-shrink-0">
                        <Heart size={11} className="text-gray-300" />
                        {post.like_count}
                      </span>
                      <span className="flex items-center gap-0.5 text-[11px] text-gray-400 flex-shrink-0">
                        <MessageCircle size={11} className="text-gray-300" />
                        {post.comment_count}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
