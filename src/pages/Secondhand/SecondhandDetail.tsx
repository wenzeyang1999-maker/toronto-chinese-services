// ─── Secondhand Detail Page ───────────────────────────────────────────────────
// Route: /secondhand/:id  (used on mobile)
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, MapPin, Phone, MessageCircle, Copy, Package, User, ExternalLink, MessageSquare, Star, Flag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { SECONDHAND_CATEGORY_CONFIG, ITEM_CONDITION_CONFIG, getPriceLabel, type SecondhandItem } from './types'
import SaveButton from '../../components/SaveButton/SaveButton'
import ShareButton from '../../components/ShareButton/ShareButton'
import PageMeta from '../../components/PageMeta/PageMeta'
import ViewCount from '../../components/ViewCount/ViewCount'
import SecondhandComments from './components/SecondhandComments'
import { toast } from '../../lib/toast'

const REPORT_REASONS = [
  { key: 'fake',       label: '虚假信息' },
  { key: 'spam',       label: '垃圾广告' },
  { key: 'malicious',  label: '欺诈/恶意' },
  { key: 'irrelevant', label: '内容无关' },
  { key: 'other',      label: '其他' },
] as const

interface Review {
  id: string
  reviewer_id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: { name: string; avatar_url: string | null } | null
}

export default function SecondhandDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [item,    setItem]    = useState<SecondhandItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgIdx,  setImgIdx]  = useState(0)
  const [copied,  setCopied]  = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [showReportForm,   setShowReportForm]   = useState(false)
  const [reportReason,     setReportReason]     = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportSubmitted,  setReportSubmitted]  = useState(false)
  const [reportError,      setReportError]      = useState<string | null>(null)

  // Reviews state
  const [reviews,       setReviews]       = useState<Review[]>([])
  const [reviewsReady,  setReviewsReady]  = useState(false)
  const [myRating,      setMyRating]      = useState(0)
  const [myComment,     setMyComment]     = useState('')
  const [submittingRev, setSubmittingRev] = useState(false)
  const [myReview,      setMyReview]      = useState<Review | null>(null)

  useEffect(() => {
    if (!id || !user) return
    supabase.from('content_reports')
      .select('content_id')
      .eq('content_type', 'secondhand')
      .eq('content_id', id)
      .eq('reporter_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setReportSubmitted(true) })
  }, [id, user])

  useEffect(() => {
    if (!id) return
    supabase
      .from('secondhand')
      .select('*, seller:users(id, name, avatar_url)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setItem({
            ...data,
            images: data.images ?? [],
            seller: Array.isArray(data.seller) ? (data.seller[0] ?? null) : (data.seller ?? null),
          } as SecondhandItem)
        }
        setLoading(false)
      })
  }, [id])

  // Load reviews once item is loaded
  useEffect(() => {
    if (!id) return
    supabase
      .from('secondhand_reviews')
      .select('id, reviewer_id, rating, comment, created_at, reviewer:users(name, avatar_url)')
      .eq('item_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) { setReviewsReady(true); return }
        const mapped = data.map((r: any) => ({
          ...r,
          reviewer: Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
        }))
        setReviews(mapped)
        if (user) {
          const mine = mapped.find((r: Review) => r.reviewer_id === user.id)
          if (mine) setMyReview(mine)
        }
        setReviewsReady(true)
      })
  }, [id, user])

  async function copyWechat() {
    if (!item?.contact_wechat) return
    try {
      await navigator.clipboard.writeText(item.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(`微信号：${item.contact_wechat}（请手动复制）`)
    }
  }

  async function messageSeller() {
    if (!user) { navigate('/login'); return }
    if (!item?.seller) return
    setMessaging(true)
    try {
      // Look up existing conversation first (NULL != NULL in unique constraint)
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('client_id', user.id)
        .eq('provider_id', item.seller.id)
        .is('service_id', null)
        .maybeSingle()

      if (existing) {
        navigate(`/conversation/${existing.id}`)
        return
      }
      const { data, error } = await supabase
        .from('conversations')
        .insert({ client_id: user.id, provider_id: item.seller.id, service_id: null })
        .select('id')
        .single()
      if (!error && data) navigate(`/conversation/${data.id}`)
    } finally {
      setMessaging(false)
    }
  }

  async function submitReport() {
    if (!id || !user || !reportReason) return
    setReportError(null)
    setReportSubmitting(true)
    const { error } = await supabase.from('content_reports').insert({
      content_type: 'secondhand',
      content_id: id,
      content_title: item?.title ?? '二手商品',
      reporter_id: user.id,
      reason: reportReason,
    })
    setReportSubmitting(false)
    if (error) {
      setReportError(error.code === '23505' ? '您已经举报过这个商品了' : '举报失败，请稍后再试')
      return
    }
    setReportSubmitted(true)
    setReportReason('')
    setShowReportForm(false)
  }

  async function submitReview() {
    if (!user || !id || myRating === 0) return
    setSubmittingRev(true)
    const { data, error } = await supabase
      .from('secondhand_reviews')
      .insert({
        item_id:     id,
        reviewer_id: user.id,
        seller_id:   item?.seller_id ?? null,
        rating:      myRating,
        comment:     myComment.trim() || null,
      })
      .select('id, reviewer_id, rating, comment, created_at')
      .single()
    if (!error && data) {
      const rev: Review = { ...data, reviewer: { name: '我', avatar_url: null } }
      setMyReview(rev)
      setReviews(prev => [rev, ...prev])
      setMyRating(0)
      setMyComment('')
    }
    setSubmittingRev(false)
  }

  const isOwn = !!user && item?.seller_id === user.id
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800 flex-1 truncate">
          {loading ? '加载中…' : (item?.title ?? '物品不存在')}
        </span>
        {item && <SaveButton type="secondhand" id={item.id} size={20} className="w-9 h-9" />}
        {item && <ShareButton title={item.title} size={18} className="w-9 h-9" />}
      </div>

      {loading ? (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3 animate-pulse">
          <div className="aspect-video bg-gray-200 rounded-2xl" />
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
        </div>
      ) : !item ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">物品不存在或已下架</p>
          <button onClick={() => navigate('/secondhand')}
            className="mt-3 text-primary-600 text-sm underline">返回列表</button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto pb-8">
          <PageMeta
            title={item.title}
            description={item.description?.slice(0, 120)}
            image={item.images?.[0]}
          />

          {/* Sold banner */}
          {item.is_sold && (
            <div className="bg-gray-800 text-white text-center py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
              🏷️ 此物品已卖出
            </div>
          )}

          {/* Images */}
          {item.images.length > 0 ? (
            <div>
              <div className="relative aspect-video overflow-hidden bg-gray-100">
                <img src={item.images[imgIdx]} alt={item.title}
                  className="w-full h-full object-contain" />
                {/* Sold watermark */}
                {item.is_sold && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-white text-3xl font-extrabold tracking-widest
                                     border-4 border-white px-8 py-3 rounded-2xl
                                     bg-black/50 rotate-[-20deg] select-none">
                      已卖出
                    </span>
                  </div>
                )}
              </div>
              {item.images.length > 1 && (
                <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white">
                  {item.images.map((img, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                        imgIdx === i ? 'border-primary-500' : 'border-transparent'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="relative aspect-video bg-gray-50 flex items-center justify-center text-8xl">
              {SECONDHAND_CATEGORY_CONFIG[item.category].emoji}
              {item.is_sold && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-3xl font-extrabold border-4 border-white px-8 py-3 rounded-2xl bg-black/50 rotate-[-20deg]">
                    已卖出
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="px-4 py-4 space-y-4">

            {/* Main card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              {/* Title + condition */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-xl font-bold text-gray-900 leading-tight flex-1">{item.title}</h1>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${ITEM_CONDITION_CONFIG[item.condition].color}`}>
                  {ITEM_CONDITION_CONFIG[item.condition].label}
                </span>
              </div>

              {/* Price */}
              <p className={`text-2xl font-bold mb-4 ${item.is_free ? 'text-green-600' : item.is_sold ? 'text-gray-400 line-through' : 'text-primary-600'}`}>
                {getPriceLabel(item)}
                {item.is_sold && <span className="ml-2 text-sm font-normal text-gray-500 no-underline">（已售出）</span>}
              </p>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  {SECONDHAND_CATEGORY_CONFIG[item.category].emoji} {SECONDHAND_CATEGORY_CONFIG[item.category].label}
                </span>
                {item.area && item.area.length > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    <MapPin size={11} />{item.area.join('·')}
                  </span>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                  发布于 {new Date(item.created_at).toLocaleDateString('zh-CN')}
                </span>
                {reviews.length > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                    <Star size={10} className="fill-amber-500 text-amber-500" />
                    {avgRating.toFixed(1)} ({reviews.length} 评价)
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">物品描述</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>
              </div>
              <ViewCount type="secondhand" id={item.id} className="mt-3" />

              {/* Report */}
              {user && !isOwn && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  {reportSubmitted ? (
                    <span className="flex items-center gap-1 text-xs text-orange-500">
                      <Flag size={12} /> 已举报，我们会尽快处理
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowReportForm(v => !v)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
                    >
                      <Flag size={12} /> 举报此商品
                    </button>
                  )}
                  <AnimatePresence>
                    {showReportForm && !reportSubmitted && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-semibold text-orange-700">选择举报原因</p>
                          <div className="space-y-1">
                            {REPORT_REASONS.map(opt => (
                              <label key={opt.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input
                                  type="radio"
                                  name="secondhand-report"
                                  value={opt.key}
                                  checked={reportReason === opt.key}
                                  onChange={() => setReportReason(opt.key)}
                                  className="accent-orange-500"
                                />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                          {reportError && <p className="text-xs text-red-500">{reportError}</p>}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => { setShowReportForm(false); setReportReason(''); setReportError(null) }}
                              className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white transition-colors"
                            >
                              取消
                            </button>
                            <button
                              onClick={submitReport}
                              disabled={!reportReason || reportSubmitting}
                              className="flex-1 text-xs py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                            >
                              {reportSubmitting ? '提交中…' : '提交举报'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

            {/* Contact card — hidden for own items */}
            {!isOwn && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <h2 className="text-sm font-semibold text-gray-700 mb-4">联系卖家</h2>

                <div className="flex items-center gap-3 mb-4">
                  <div
                    onClick={() => item.seller && navigate(`/provider/${item.seller.id}`)}
                    className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0
                               cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
                  >
                    {item.seller?.avatar_url
                      ? <img src={item.seller.avatar_url} alt={item.contact_name}
                          className="w-full h-full rounded-full object-cover" />
                      : <User size={18} className="text-primary-600" />
                    }
                  </div>
                  <span className="text-sm font-semibold text-gray-900 flex-1">{item.contact_name}</span>
                  {item.seller && (
                    <button
                      onClick={() => navigate(`/provider/${item.seller!.id}`)}
                      className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold
                                 bg-primary-50 hover:bg-primary-100 border border-primary-200
                                 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      <ExternalLink size={12} />
                      查看主页
                    </button>
                  )}
                </div>

                {/* Message button */}
                {!item.is_sold && item.seller && (
                  <button
                    onClick={messageSeller}
                    disabled={messaging}
                    className="w-full flex items-center justify-center gap-2 mb-3
                               bg-primary-600 hover:bg-primary-700 active:scale-95
                               text-white text-sm font-semibold py-3 rounded-xl transition-all
                               disabled:opacity-60"
                  >
                    <MessageSquare size={16} />
                    {messaging ? '连接中…' : '发消息给卖家'}
                  </button>
                )}

                <div className="flex gap-3">
                  <a href={`tel:${item.contact_phone}`}
                    className="flex-1 flex items-center justify-center gap-2
                               bg-gray-100 hover:bg-gray-200 active:scale-95
                               text-gray-800 text-sm font-semibold py-3 rounded-xl transition-all"
                  >
                    <Phone size={16} />
                    {item.contact_phone}
                  </a>
                  {item.contact_wechat && (
                    <button onClick={copyWechat}
                      className="flex items-center justify-center gap-2
                                 bg-green-500 hover:bg-green-600 active:scale-95
                                 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-all"
                    >
                      {copied ? <Copy size={16} /> : <MessageCircle size={16} />}
                      {copied ? '已复制' : '微信'}
                    </button>
                  )}
                </div>

                {item.contact_wechat && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    微信号：{item.contact_wechat}
                  </p>
                )}
              </motion.div>
            )}

            {/* ── Public comments / Q&A ──────────────────────────────────── */}
            <SecondhandComments itemId={item.id} sellerId={item.seller_id} />

            {/* ── Reviews ─────────────────────────────────────────────────── */}
            {reviewsReady && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-700">
                    买家评价 {reviews.length > 0 && `(${reviews.length})`}
                  </h2>
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-1 text-amber-500">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={14} className={s <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'} />
                      ))}
                      <span className="text-sm font-bold text-gray-700 ml-1">{avgRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Write review — only for non-owners who haven't reviewed yet */}
                {user && !isOwn && !myReview && (
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">写评价</p>
                    <div className="flex gap-1 mb-3">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setMyRating(s)}>
                          <Star size={24} className={s <= myRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 fill-gray-100'} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={myComment}
                      onChange={e => setMyComment(e.target.value)}
                      placeholder="分享你的购买体验（可选）"
                      rows={3}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none resize-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                    />
                    <button
                      onClick={submitReview}
                      disabled={myRating === 0 || submittingRev}
                      className="mt-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-40 transition-colors"
                    >
                      {submittingRev ? '提交中…' : '提交评价'}
                    </button>
                  </div>
                )}

                {myReview && (
                  <div className="mb-3 pb-3 border-b border-gray-100 bg-primary-50 rounded-xl p-3">
                    <p className="text-xs text-primary-600 font-medium mb-1">我的评价</p>
                    <div className="flex gap-0.5 mb-1">
                      {[1,2,3,4,5].map(s => <Star key={s} size={12} className={s <= myReview.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'} />)}
                    </div>
                    {myReview.comment && <p className="text-sm text-gray-700">{myReview.comment}</p>}
                  </div>
                )}

                {reviews.filter(r => r.reviewer_id !== user?.id).length === 0 && !myReview && (
                  <p className="text-sm text-gray-400 text-center py-3">暂无评价</p>
                )}

                <AnimatePresence>
                  {reviews.filter(r => r.reviewer_id !== user?.id).map((r) => (
                    <motion.div key={r.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex gap-3 py-3 border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary-600">
                        {r.reviewer?.avatar_url
                          ? <img src={r.reviewer.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          : (r.reviewer?.name?.slice(0, 1) ?? '?')
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-800">{r.reviewer?.name ?? '用户'}</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => <Star key={s} size={11} className={s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'} />)}
                          </div>
                          <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
                        </div>
                        {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {/* CTA */}
            {!isOwn && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-primary-50 border border-primary-100 rounded-2xl p-4 text-center"
              >
                <p className="text-sm text-primary-700 font-medium mb-2">有闲置要出售？</p>
                <button
                  onClick={() => user ? navigate('/secondhand/post') : navigate('/login')}
                  className="text-sm text-primary-600 font-semibold underline"
                >
                  免费发布闲置
                </button>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
