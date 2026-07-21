import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquareText, ChevronRight, Heart } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface Post { id: string; title: string; like_count: number }

// Compact home entry that surfaces 社区圈子 (community) directly — otherwise it's
// buried behind the /plaza hub (2-3 taps). Shows the latest few posts as a teaser
// and links straight to /community.
export default function HomeCommunityEntry() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])

  useEffect(() => {
    let active = true
    supabase
      .from('community_posts')
      .select('id, title, like_count')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => { if (active && data) setPosts(data as Post[]) })
    return () => { active = false }
  }, [])

  return (
    <section className="mb-4">
      <button
        onClick={() => navigate('/community')}
        className="w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm text-left
                   hover:bg-gray-50 active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500
                          flex items-center justify-center text-white">
            <MessageSquareText size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900">大多广场 · 社区圈子</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {posts[0] ? `最新：${posts[0].title}` : '求推荐 · 经验分享 · 问答 · 转让'}
            </p>
          </div>
          <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
        </div>

        {posts.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
            {posts.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="flex-1 truncate">· {p.title}</span>
                <span className="flex items-center gap-0.5 text-gray-400 flex-shrink-0">
                  <Heart size={10} /> {p.like_count}
                </span>
              </div>
            ))}
          </div>
        )}
      </button>
    </section>
  )
}
