// ─── Plaza Page (大多广场) ──────────────────────────────────────────────────────
// Route: /plaza
// Hub for community & events content.
// Sub-tabs: 社区圈子 | 同城活动 | 集市摊位 (coming) | 公益慈善 (coming)
// Sub-tab persists in URL: /plaza?tab=community (default) | events | market | charity
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CommunityDrawer from '../../components/CommunityDrawer/CommunityDrawer'
import EventDrawer from '../../components/EventDrawer/EventDrawer'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, MapPin, Clock, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useEventsStore } from '../../store/eventsStore'
import { useReadStore } from '../../store/readStore'
import Header from '../../components/Header/Header'
import PostFAB from '../../components/PostFAB/PostFAB'
import PageMeta from '../../components/PageMeta/PageMeta'
import { POST_TYPE_CONFIG, AREA_CONFIG } from '../Community/config'
import {
  EVENT_TYPE_CONFIG, getPriceLabel, formatEventTime, isUpcoming,
  type Event,
} from '../Events/types'

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (h < 1) return '刚刚'
  if (h < 24) return `${Math.floor(h)}小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}天前`
  return `${Math.floor(d / 30)}个月前`
}

// ── Community types ───────────────────────────────────────────────────────────
interface CommunityPost {
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

type PlazaTab = 'community' | 'events' | 'market' | 'charity'

const PLAZA_TABS: { id: PlazaTab; label: string; emoji: string; live: boolean }[] = [
  { id: 'community', label: '社区圈子', emoji: '🏘️', live: true  },
  { id: 'events',    label: '同城活动', emoji: '🎉', live: true  },
  { id: 'market',    label: '集市摊位', emoji: '🏪', live: false },
  { id: 'charity',   label: '公益慈善', emoji: '💝', live: false },
]

export default function PlazaPage() {
  const navigate          = useNavigate()
  const user              = useAuthStore((s) => s.user)
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = (searchParams.get('tab') as PlazaTab) ?? 'community'
  function setTab(tab: PlazaTab) { setSearchParams({ tab }, { replace: true }) }

  // ── Community state ─────────────────────────────────────────────────────────
  const [posts,      setPosts]      = useState<CommunityPost[]>([])
  const [postLoad,   setPostLoad]   = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all')

  const loadPosts = useCallback(async () => {
    setPostLoad(true)
    let q = supabase
      .from('community_posts')
      .select('id, title, content, type, area, like_count, created_at, images, author:author_id(id, name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (typeFilter !== 'all') q = q.eq('type', typeFilter)
    if (areaFilter !== 'all') q = q.eq('area', areaFilter)
    const { data } = await q
    if (!data) { setPostLoad(false); return }
    const ids = data.map((p: any) => p.id)
    if (!ids.length) { setPosts([]); setPostLoad(false); return }
    const { data: counts } = await supabase
      .from('community_comments').select('post_id').in('post_id', ids)
    const countMap: Record<string, number> = {}
    counts?.forEach((c: any) => { countMap[c.post_id] = (countMap[c.post_id] ?? 0) + 1 })
    const mapped = data.map((p: any) => ({
      ...p,
      author:        Array.isArray(p.author) ? p.author[0] : p.author,
      comment_count: countMap[p.id] ?? 0,
    }))
    for (let i = mapped.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mapped[i], mapped[j]] = [mapped[j], mapped[i]]
    }
    setPosts(mapped)
    setPostLoad(false)
  }, [typeFilter, areaFilter])

  useEffect(() => { if (activeTab === 'community') loadPosts() }, [activeTab, loadPosts])

  // ── Events state ────────────────────────────────────────────────────────────
  const { fetchEvents, getFilteredEvents, isReady: eventsReady, setFilters: setEventFilters, filters: eventFilters } = useEventsStore()
  useEffect(() => { if (activeTab === 'events') fetchEvents() }, [activeTab])
  const events = getFilteredEvents()

  // ── Read state ──────────────────────────────────────────────────────────────
  const readSet  = useReadStore((s) => s.read)
  const markRead = useReadStore((s) => s.markRead)

  // ── Community drawer ────────────────────────────────────────────────────────
  const [drawerPostId,  setDrawerPostId]  = useState<string | null>(null)

  // ── Event drawer ─────────────────────────────────────────────────────────────
  const [drawerEventId, setDrawerEventId] = useState<string | null>(null)

  // ── FAB target per tab ──────────────────────────────────────────────────────
  const fabTarget = activeTab === 'community'
    ? '/community/post'
    : activeTab === 'events'
      ? '/events/post'
      : null

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <PageMeta title="大多广场 · 社区" description="大多伦多华人社区圈子、同城活动、集市摊位" />
      <Header />

      {/* ── Sub-tab bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 sticky top-14 z-20">
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          <div className="flex overflow-x-auto scrollbar-hide gap-1 py-1">
            {PLAZA_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.live && setTab(tab.id)}
                disabled={!tab.live}
                className={`relative flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                  ${!tab.live ? 'text-gray-300 cursor-not-allowed' : activeTab === tab.id
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                {!tab.live && (
                  <span className="text-[9px] font-bold bg-gray-200 text-gray-400 rounded-full px-1 leading-tight">
                    即将
                  </span>
                )}
                {activeTab === tab.id && tab.live && (
                  <motion.div
                    layoutId="plaza-underline"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Community Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'community' && (
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto">
          {/* Filters */}
          <div className="bg-white border-b border-gray-100 -mx-3 md:mx-0 px-3 md:px-0 py-2.5 space-y-2 mb-4">
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

          {/* Masonry grid */}
          <div className="pt-2">
            {postLoad ? (
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
              <div style={{ columns: '220px', columnGap: '10px' }}>
                {posts.map((post, i) => {
                  const tc      = POST_TYPE_CONFIG[post.type]
                  const hasImg  = (post.images?.length ?? 0) > 0
                  const coverImg = post.images?.[0]
                  const isRead  = readSet.has(`community:${post.id}`)
                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => { markRead('community', post.id); setDrawerPostId(post.id) }}
                      className={`break-inside-avoid mb-2.5 bg-white rounded-2xl overflow-hidden
                                 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]
                                 ${isRead ? 'opacity-75' : ''}`}
                    >
                      {hasImg && (
                        <img src={coverImg} alt={post.title} loading="lazy"
                          className="w-full object-cover" style={{ display: 'block' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      )}
                      {!hasImg && (
                        <div className="w-full py-6 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                          <span className="text-4xl opacity-60">{tc?.emoji ?? '💬'}</span>
                        </div>
                      )}
                      <div className="px-3 pt-2 pb-3">
                        <p className={`text-sm font-semibold line-clamp-2 leading-snug mb-1.5 ${isRead ? 'text-gray-400' : 'text-gray-900'}`}>
                          {post.title}
                        </p>
                        {post.area && post.area !== 'all' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-1.5 py-0.5 mb-1.5">
                            <MapPin size={9} className="flex-shrink-0" />
                            {AREA_CONFIG[post.area] ?? post.area}
                          </span>
                        )}
                        {!hasImg && (
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-2">
                            {post.content}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[9px] font-bold">
                            {post.author?.avatar_url ? (
                              <img src={post.author.avatar_url} alt=""
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            ) : (post.author?.name?.charAt(0) ?? '?')}
                          </div>
                          <span className="text-[11px] text-gray-400 truncate flex-1">
                            {post.author?.name ?? '匿名'}
                          </span>
                          <span className="text-[10px] text-gray-300 flex-shrink-0">
                            {timeAgo(post.created_at)}
                          </span>
                          <span className="flex items-center gap-0.5 text-[11px] text-gray-400 flex-shrink-0">
                            <Heart size={11} className="text-gray-300" />{post.like_count}
                          </span>
                          <span className="flex items-center gap-0.5 text-[11px] text-gray-400 flex-shrink-0">
                            <MessageCircle size={11} className="text-gray-300" />{post.comment_count}
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
      )}

      {/* ── Events Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'events' && (
        <div className="w-full px-3 md:w-[85%] md:px-0 lg:w-[70%] mx-auto pt-4">
          {/* Upcoming toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setEventFilters({ upcoming_only: true })}
              className={`text-sm px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                eventFilters.upcoming_only
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >即将开始</button>
            <button
              onClick={() => setEventFilters({ upcoming_only: false })}
              className={`text-sm px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                !eventFilters.upcoming_only
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >全部活动</button>
          </div>

          {!eventsReady ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无活动</p>
              {user && (
                <button onClick={() => navigate('/events/post')}
                  className="text-xs text-primary-600 underline mt-1">发布第一个活动</button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => {
                const cfg    = EVENT_TYPE_CONFIG[ev.event_type]
                const past   = !isUpcoming(ev)
                const isRead = readSet.has(`event:${ev.id}`)
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => { markRead('event', ev.id); setDrawerEventId(ev.id) }}
                    className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 cursor-pointer
                                hover:border-gray-300 hover:shadow-md transition-all
                                ${past ? 'opacity-60' : ''} ${isRead ? 'opacity-75' : ''}`}
                  >
                    {/* Date badge */}
                    <div className="flex-shrink-0 w-12 flex flex-col items-center bg-primary-50 rounded-xl py-1.5 px-1 text-center">
                      <span className="text-[10px] font-bold text-primary-400 leading-none">
                        {new Date(ev.event_date + 'T00:00:00').toLocaleString('zh-CN', { month: 'short' })}
                      </span>
                      <span className="text-xl font-extrabold text-primary-700 leading-tight">
                        {new Date(ev.event_date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className={`text-sm font-semibold leading-snug line-clamp-2 ${isRead ? 'text-gray-400' : 'text-gray-900'}`}>
                          {ev.title}
                        </p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
                          {cfg.emoji} {cfg.label}
                        </span>
                      </div>
                      {(ev.location_name || ev.address) && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 truncate mb-1">
                          <MapPin size={11} className="flex-shrink-0" />
                          {ev.location_name ?? ev.address}
                        </p>
                      )}
                      <div className="flex items-center gap-3">
                        {ev.event_time && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={11} />{formatEventTime(ev.event_time)}
                          </p>
                        )}
                        <p className={`text-xs font-bold ${ev.price ? 'text-primary-600' : 'text-green-600'}`}>
                          {getPriceLabel(ev)}
                        </p>
                        {past && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">已结束</span>}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Coming soon tabs ─────────────────────────────────────────────────── */}
      {(activeTab === 'market' || activeTab === 'charity') && (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <p className="text-5xl mb-4">{activeTab === 'market' ? '🏪' : '💝'}</p>
          <p className="text-base font-semibold text-gray-600 mb-2">
            {activeTab === 'market' ? '集市摊位' : '公益慈善'}
          </p>
          <p className="text-sm">功能即将上线，敬请期待 ✨</p>
        </div>
      )}

      {/* FAB */}
      {user && fabTarget && <PostFAB onClick={() => navigate(fabTarget)} />}

      {/* Community post drawer */}
      {drawerPostId && (
        <CommunityDrawer postId={drawerPostId} onClose={() => setDrawerPostId(null)} />
      )}

      {/* Event drawer */}
      {drawerEventId && (
        <EventDrawer eventId={drawerEventId} onClose={() => setDrawerEventId(null)} />
      )}
    </div>
  )
}
