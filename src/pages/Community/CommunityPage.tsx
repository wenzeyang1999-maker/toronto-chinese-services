// ─── Community Page (瀑布流 / 小红书风格) ────────────────────────────────────
// Route: /community
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share2, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useReadStore } from '../../store/readStore'
import { useFollowsStore } from '../../store/followsStore'
import Header from '../../components/Header/Header'
import PostFAB from '../../components/PostFAB/PostFAB'
import PullIndicator from '../../components/PullToRefresh/PullIndicator'
import ErrorState from '../../components/ErrorState/ErrorState'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { POST_TYPE_CONFIG, AREA_CONFIG } from './config'
import ImgFallback from '../../components/ImgFallback/ImgFallback'

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

const PAGE_SIZE = 10   // 每次抓一小批，滚到底再抓下一批，抓完就停

export default function CommunityPage() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const readSet  = useReadStore((s) => s.read)
  const markRead = useReadStore((s) => s.markRead)

  const [posts,       setPosts]       = useState<Post[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(true)
  const [loadError,   setLoadError]   = useState(false)
  const [typeFilter,  setTypeFilter]  = useState<string>('all')
  const [areaFilter,  setAreaFilter]  = useState<string>('all')
  const [followMode,  setFollowMode]  = useState(false)
  const [copiedId,    setCopiedId]    = useState<string | null>(null)
  const offsetRef   = useRef(0)                       // 已加载条数（分页游标）
  const sentinelRef = useRef<HTMLDivElement>(null)    // 触底哨兵

  const following    = useFollowsStore((s) => s.following)
  const fetchFollows = useFollowsStore((s) => s.fetchFollows)
  const followsReady = useFollowsStore((s) => s.isReady)
  useEffect(() => { if (user && !followsReady) fetchFollows(user.id) }, [user?.id, followsReady, fetchFollows])

  // Share a specific post from the list card (mirrors CommunityDetail.sharePost,
  // but targets the post's own URL instead of window.location). stopPropagation
  // keeps the card's navigate-to-detail click from firing.
  async function sharePost(e: React.MouseEvent, post: Post) {
    e.stopPropagation()
    const url = `${window.location.origin}/community/${post.id}`
    const snippet = post.content.slice(0, 120) + (post.content.length > 120 ? '…' : '')
    const shareText = [`📢 ${post.title}`, snippet, `👉 华邻 · 社区论坛`].filter(Boolean).join('\n\n')

    if (navigator.share) {
      try { await navigator.share({ title: post.title, text: shareText, url }) } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(`${shareText}\n${url}`) } catch { /* ignore */ }
      setCopiedId(post.id)
      setTimeout(() => setCopiedId((cur) => (cur === post.id ? null : cur)), 2000)
    }
  }

  // 分页加载：reset=true 从头拉第一批（换筛选/下拉刷新）；reset=false 追加下一批。
  const loadPage = useCallback(async (reset: boolean) => {
    const followAuthorIds = followMode ? [...following] : null
    if (followAuthorIds && followAuthorIds.length === 0) {
      setPosts([]); setHasMore(false); setLoading(false); setLoadingMore(false); return
    }
    if (reset) { setLoading(true); setLoadError(false); offsetRef.current = 0 }
    else       { setLoadingMore(true) }

    const from = reset ? 0 : offsetRef.current
    let q = supabase
      .from('community_posts')
      .select('id, title, content, type, area, like_count, comment_count, created_at, images, author:author_id(id, name, avatar_url)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (typeFilter !== 'all') q = q.eq('type', typeFilter)
    if (areaFilter !== 'all') q = q.eq('area', areaFilter)
    if (followAuthorIds) q = q.in('author_id', followAuthorIds)

    const { data, error } = await q
    if (error || !data) {
      if (reset) { setLoadError(true); setPosts([]) }
      setLoading(false); setLoadingMore(false); return
    }

    // 评论数直接读字段（由触发器维护）——不再二次查询 community_comments。
    const mapped: Post[] = data.map((p: any) => ({
      ...p,
      author:        Array.isArray(p.author) ? p.author[0] : p.author,
      comment_count: p.comment_count ?? 0,
    }))

    setPosts((prev) => {
      const next = reset ? mapped : [...prev, ...mapped]
      offsetRef.current = next.length
      return next
    })
    setHasMore(data.length === PAGE_SIZE)   // 不满一页 = 没有更多了
    setLoading(false); setLoadingMore(false)
  }, [typeFilter, areaFilter, followMode, following])

  const refresh = useCallback(() => loadPage(true), [loadPage])

  // 换筛选/首次进入 → 从头拉第一批
  useEffect(() => { loadPage(true) }, [loadPage])

  // 触底自动加载下一批（哨兵进入视口时）。没有更多 / 正在加载时不挂观察器。
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading || loadingMore) return
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadPage(false) },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, loadingMore, loadPage])

  const { distance, refreshing, threshold } = usePullToRefresh(refresh)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="fixed top-14 left-0 right-0 z-[45] pointer-events-none">
        <PullIndicator distance={distance} refreshing={refreshing} threshold={threshold} />
      </div>
      <Header />

      {/* Filters */}
      <div className="bg-white border-b border-gray-100">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto py-2.5 space-y-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {user && (
              <button onClick={() => setFollowMode((v) => !v)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                            ${followMode ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-primary-600 border-primary-300 hover:bg-primary-50'}`}>
                ❤️ 关注
              </button>
            )}
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
      {user && <PostFAB onClick={() => navigate('/community/post')} />}

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
        ) : loadError && posts.length === 0 ? (
          <ErrorState onRetry={refresh} />
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
                  onClick={() => { markRead('community', post.id); navigate(`/community/${post.id}`) }}
                  className={`break-inside-avoid mb-2.5 bg-white rounded-2xl overflow-hidden
                             cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]
                             ${readSet.has(`community:${post.id}`) ? 'opacity-75' : ''}`}
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
                    <p className={`text-sm font-semibold line-clamp-2 leading-snug mb-2 ${readSet.has(`community:${post.id}`) ? 'text-gray-400' : 'text-gray-900'}`}>
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
                        <ImgFallback
                          src={post.author.avatar_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                          fallback={
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                            flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                              {post.author?.name?.charAt(0) ?? '?'}
                            </div>
                          }
                        />
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
                      <button
                        onClick={(e) => sharePost(e, post)}
                        aria-label="分享"
                        className="flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-primary-500 transition-colors active:scale-90"
                      >
                        {copiedId === post.id
                          ? <Check size={12} className="text-green-500" />
                          : <Share2 size={12} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* 触底哨兵：进入视口自动加载下一批；到底则提示，不再请求 */}
        {!loading && posts.length > 0 && (
          <div ref={sentinelRef} className="py-6 text-center text-xs text-gray-400">
            {loadingMore ? '加载中…' : hasMore ? '' : '— 已经到底了 —'}
          </div>
        )}
      </div>
    </div>
  )
}
