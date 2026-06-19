// ─── Admin · Community posts tab ─────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAdminContext } from '../AdminContext'

interface CommunityPostRow {
  id: string
  title: string
  type: string
  area: string
  created_at: string
  author: { name: string } | null
}

const PAGE = 30

export default function CommunityTab() {
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [posts,   setPosts]   = useState<CommunityPostRow[]>([])
  const [hasMore, setHasMore] = useState(false)

  async function loadCommunityPosts(append = false) {
    const start = append ? posts.length : 0
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, title, type, area, created_at, author:author_id(name)')
      .order('created_at', { ascending: false })
      .range(start, start + PAGE - 1)
    if (error) {
      showNotice('error', `加载社区帖子失败：${error.message}`)
      return
    }
    const mapped = (data ?? []).map((p: any) => ({ ...p, author: Array.isArray(p.author) ? p.author[0] : p.author }))
    if (append) setPosts(prev => [...prev, ...mapped])
    else setPosts(mapped)
    setHasMore((data ?? []).length === PAGE)
  }

  async function deleteCommunityPost(postId: string) {
    setActing(postId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_delete_community_post', { post_id: postId })
      if (error) throw error
    }, '社区帖子已删除')
    if (ok !== null) {
      setPosts(prev => prev.filter(p => p.id !== postId))
    }
    setActing(null)
  }

  useEffect(() => {
    void loadCommunityPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {posts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-400">暂无社区帖子</p>
        </div>
      ) : (
        <>
          {posts.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{p.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.author?.name ?? '匿名'} · {p.type} · {p.area} · {p.created_at.slice(0, 10)}
                </p>
              </div>
              <button onClick={() => deleteCommunityPost(p.id)} disabled={acting === p.id}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700
                           border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg
                           transition-colors disabled:opacity-50 flex-shrink-0">
                <Trash2 size={13} /> 删除
              </button>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => loadCommunityPosts(true)}
              className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              加载更多
            </button>
          )}
        </>
      )}
    </motion.div>
  )
}
