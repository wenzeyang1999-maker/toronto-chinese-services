// ─── Community Section ────────────────────────────────────────────────────────
// Shows the current user's community posts with delete option.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PenSquare, Trash2, MessageCircle, Heart } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { POST_TYPE_CONFIG, AREA_CONFIG } from '../../Community/config'

interface Post {
  id: string
  title: string
  content: string
  type: string
  area: string
  like_count: number
  created_at: string
  comment_count: number
}

export default function CommunitySection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [posts,   setPosts]   = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('community_posts')
      .select('id, title, content, type, area, like_count, created_at')
      .eq('author_id', user!.id)
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    const ids = data.map(p => p.id)
    const { data: counts } = await supabase
      .from('community_comments')
      .select('post_id')
      .in('post_id', ids)

    const countMap: Record<string, number> = {}
    counts?.forEach((c: any) => { countMap[c.post_id] = (countMap[c.post_id] ?? 0) + 1 })

    setPosts(data.map(p => ({ ...p, comment_count: countMap[p.id] ?? 0 })))
    setLoading(false)
  }

  async function deletePost(postId: string) {
    if (!confirm('确定删除这条帖子？')) return
    setPosts(prev => prev.filter(p => p.id !== postId))
    await supabase.from('community_posts').delete().eq('id', postId)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500">我的社区帖子</h2>
        <button onClick={() => navigate('/community/post')}
          className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700
                     text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors">
          <PenSquare size={12} /> 发帖
        </button>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
          <p className="text-3xl mb-2">🌱</p>
          还没有发过帖子
          <br />
          <button onClick={() => navigate('/community/post')}
            className="mt-3 text-primary-600 font-semibold hover:underline text-sm">
            去发第一条 →
          </button>
        </div>
      ) : (
        <AnimatePresence>
          {posts.map((post, i) => {
            const tc = POST_TYPE_CONFIG[post.type]
            return (
              <motion.div key={post.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ delay: i * 0.03 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/community/${post.id}`)}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${tc?.color}`}>
                        {tc?.emoji} {tc?.label}
                      </span>
                      <span className="text-xs text-gray-400">📍 {AREA_CONFIG[post.area] ?? post.area}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{post.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">{post.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><MessageCircle size={11} /> {post.comment_count}</span>
                      <span className="flex items-center gap-1"><Heart size={11} /> {post.like_count}</span>
                      <span>{post.created_at.slice(0, 10)}</span>
                    </div>
                  </div>
                  <button onClick={() => deletePost(post.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      )}
    </div>
  )
}
