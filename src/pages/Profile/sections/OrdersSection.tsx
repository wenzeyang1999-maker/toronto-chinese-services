import { useEffect, useState } from 'react'
import { Store, Star, Camera, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../../../store/authStore'
import { supabase } from '../../../lib/supabase'
import { toast } from '../../../lib/toast'
import { compressImage } from '../../../lib/compressImage'
import { moderateImage } from '../../../lib/moderateImage'
import Badge from '../../../components/Badge/Badge'

interface OrderRow {
  id: string
  client_id: string
  provider_id: string
  service_id: string | null
  title: string | null
  amount: number | null
  status: string
  created_by: string
  created_at: string
  completion_photos: string[] | null
  client:   { name: string | null } | null
  provider: { name: string | null } | null
}

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  pending:   { label: '待确认', tone: 'warning' },
  confirmed: { label: '已成交', tone: 'success' },
  completed: { label: '已完成', tone: 'success' },
  cancelled: { label: '已取消', tone: 'neutral' },
}

export default function OrdersSection() {
  const user = useAuthStore((s) => s.user)
  const [orders, setOrders]   = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [acting, setActing]   = useState<string | null>(null)
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [stars, setStars]     = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [disputeMap, setDisputeMap] = useState<Record<string, string>>({}) // order_id → dispute status
  const [disputingId, setDisputingId] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [submittingDispute, setSubmittingDispute] = useState(false)

  async function load() {
    if (!user) return
    setLoadError(false)
    const { data, error } = await supabase
      .from('orders')
      .select('*, client:client_id(name), provider:provider_id(name)')
      .or(`client_id.eq.${user.id},provider_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    if (error) { setLoadError(true); setLoading(false); return }  // 真错误态，不伪装成"没数据"
    const rows = (data ?? []) as OrderRow[]
    setOrders(rows)
    // Which of my orders I've already reviewed (to hide the 写评价 button).
    const { data: revs } = await supabase.from('reviews')
      .select('order_id').eq('reviewer_id', user.id).not('order_id', 'is', null)
    setReviewedIds(new Set((revs ?? []).map((r: { order_id: string }) => r.order_id)))
    // Existing disputes on my orders (to show status + hide the 发起纠纷 button).
    if (rows.length) {
      const { data: disp } = await supabase.from('disputes')
        .select('order_id, status').in('order_id', rows.map(o => o.id))
      const m: Record<string, string> = {}
      for (const d of (disp ?? []) as { order_id: string; status: string }[]) m[d.order_id] = d.status
      setDisputeMap(m)
    }
    setLoading(false)
  }

  async function raiseDispute(orderId: string) {
    if (!disputeReason.trim()) { toast('请填写纠纷原因', 'error'); return }
    setSubmittingDispute(true)
    const { data, error } = await supabase.rpc('raise_dispute', { p_order_id: orderId, p_reason: disputeReason.trim() })
    setSubmittingDispute(false)
    if (error) { toast(error.message || '发起失败，请重试', 'error'); return }
    toast('已提交纠纷，平台会尽快处理', 'success')
    setDisputingId(null); setDisputeReason('')
    // Fire-and-forget: kick off the AI 初步意见 (admin reviews it in the backend).
    void supabase.functions.invoke('arbitrate-dispute', { body: { disputeId: data } })
    void load()
  }

  async function submitReview(orderId: string) {
    if (stars === 0) { toast('请选择星级', 'error'); return }
    setSubmittingReview(true)
    const { error } = await supabase.rpc('submit_review', {
      p_order_id: orderId, p_rating: stars, p_comment: reviewText.trim() || null,
    })
    setSubmittingReview(false)
    if (error) { toast(error.message || '提交失败，请重试', 'error'); return }
    toast('评价已提交，谢谢 ✓', 'success')
    setReviewingId(null); setStars(0); setReviewText('')
    void load()
  }
  useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user])

  async function act(id: string, fn: 'confirm_order' | 'cancel_order') {
    setActing(id)
    const { error } = await supabase.rpc(fn, { p_order_id: id })
    setActing(null)
    if (error) { toast(error.message || '操作失败，请重试', 'error'); return }
    toast(fn === 'confirm_order' ? '已确认成交 ✓' : '已取消', 'success')
    void load()
  }

  // 完工存证：师傅上传 1-3 张现场照片 → 订单转 completed（说明书 §5.2）。
  async function completeOrder(orderId: string, files: FileList | null) {
    if (!user || !files || !files.length) return
    const list = Array.from(files).slice(0, 3)
    setActing(orderId)
    try {
      const urls: string[] = []
      for (const f of list) {
        const compressed = await compressImage(f)
        const imgMod = await moderateImage(compressed)   // 黄暴血腥；fail-open
        if (!imgMod.pass) {
          toast(`完工照未通过审核：${imgMod.reason ?? '含违规内容'}`, 'error')
          setActing(null)
          return
        }
        const path = `${user.id}/order-completion/${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        const { error } = await supabase.storage.from('service-images').upload(path, compressed, { upsert: false })
        if (error) throw error
        urls.push(supabase.storage.from('service-images').getPublicUrl(path).data.publicUrl)
      }
      const { error } = await supabase.rpc('complete_order', { p_order_id: orderId, p_photos: urls })
      if (error) throw error
      toast('已提交完工存证 ✓', 'success')
      void load()
    } catch (e) {
      toast((e as { message?: string })?.message || '完工提交失败，请重试', 'error')
    } finally {
      setActing(null)
    }
  }

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
          <div className="flex justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
            <div className="h-6 w-14 bg-gray-100 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
  if (loadError) return (
    <div className="py-16 text-center text-gray-400">
      <AlertTriangle size={40} className="mx-auto mb-3 text-danger-400" />
      <p className="text-sm text-gray-600">订单加载失败</p>
      <p className="text-xs text-gray-400 mt-1">请检查网络后重试</p>
      <button onClick={() => { setLoading(true); load() }}
        className="mt-4 px-5 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700">
        重新加载
      </button>
    </div>
  )
  if (!orders.length) return (
    <div className="py-16 text-center text-gray-400">
      <Store size={40} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">还没有成交记录</p>
      <p className="text-xs text-gray-300 mt-1">在与对方的站内对话里点「标记成交」即可发起</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const isProvider = o.provider_id === user?.id
        const otherName  = isProvider ? (o.client?.name ?? '客户') : (o.provider?.name ?? '商家')
        const st = STATUS[o.status] ?? STATUS.pending
        const canConfirm = o.status === 'pending' && o.created_by !== user?.id
        const canCancel  = o.status === 'pending'
        return (
          <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{o.title || '成交'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isProvider ? '客户' : '商家'}：{otherName}
                  {o.amount != null && <span className="ml-2 text-primary-600 font-semibold">${o.amount}</span>}
                </p>
                <p className="text-[11px] text-gray-300 mt-1">{new Date(o.created_at).toLocaleString('zh-CN')}</p>
              </div>
              <Badge tone={st.tone} className="flex-shrink-0">{st.label}</Badge>
            </div>

            {(canConfirm || canCancel) && (
              <div className="flex gap-2 mt-3">
                {canConfirm && (
                  <button onClick={() => act(o.id, 'confirm_order')} disabled={acting === o.id}
                    className="flex-1 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
                    确认成交
                  </button>
                )}
                <button onClick={() => act(o.id, 'cancel_order')} disabled={acting === o.id}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
                  {o.created_by === user?.id ? '撤销' : '拒绝'}
                </button>
              </div>
            )}
            {o.status === 'pending' && o.created_by === user?.id && (
              <p className="text-[11px] text-amber-600 mt-2">等待对方确认…</p>
            )}

            {/* Review — client only, on any 成交/完工 order (含无服务的询价成交), once.
                评价锚定师傅(provider_id)，不再要求 service_id；completed 也可评。*/}
            {['confirmed', 'completed'].includes(o.status) && !isProvider && !reviewedIds.has(o.id) && (
              reviewingId === o.id ? (
                <div className="mt-3 border-t border-gray-50 pt-3">
                  <div className="flex items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setStars(n)}>
                        <Star size={22} className={n <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                      </button>
                    ))}
                  </div>
                  <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={2}
                    placeholder="分享你的体验（选填）"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => submitReview(o.id)} disabled={submittingReview}
                      className="flex-1 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-60">
                      {submittingReview ? '提交中…' : '提交评价'}
                    </button>
                    <button onClick={() => { setReviewingId(null); setStars(0); setReviewText('') }}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm">取消</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setReviewingId(o.id); setStars(0); setReviewText('') }}
                  className="mt-3 w-full py-2 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-sm font-semibold hover:bg-primary-100">
                  写评价
                </button>
              )
            )}
            {['confirmed', 'completed'].includes(o.status) && !isProvider && reviewedIds.has(o.id) && (
              <p className="text-[11px] text-gray-400 mt-2">已评价 ✓</p>
            )}

            {/* 完工存证 — 仅服务商，confirmed 订单上传 1-3 张现场照片（§5.2）*/}
            {o.status === 'confirmed' && isProvider && (
              <label className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-primary-200
                                 bg-primary-50 text-primary-700 text-sm font-semibold cursor-pointer hover:bg-primary-100
                                 ${acting === o.id ? 'opacity-60 pointer-events-none' : ''}`}>
                <Camera size={15} />
                {acting === o.id ? '上传中…' : '标记完工（上传现场照）'}
                <input type="file" accept="image/*" multiple hidden
                  onChange={(e) => { void completeOrder(o.id, e.target.files); e.target.value = '' }} />
              </label>
            )}

            {/* 完工存证照片 — completed 订单双方可见 */}
            {o.status === 'completed' && o.completion_photos && o.completion_photos.length > 0 && (
              <div className="mt-3 border-t border-gray-50 pt-3">
                <p className="text-[11px] font-semibold text-gray-400 mb-1.5">完工存证</p>
                <div className="flex gap-2">
                  {o.completion_photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 hover:opacity-90">
                      <img loading="lazy" src={url} alt={`完工照 ${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 发起纠纷 — confirmed/completed 订单，任一方，无进行中纠纷时 */}
            {(o.status === 'confirmed' || o.status === 'completed') && (
              disputeMap[o.id] ? (
                <p className="mt-3 text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {disputeMap[o.id] === 'resolved' || disputeMap[o.id] === 'dismissed' ? '纠纷已处理' : '纠纷处理中，平台会尽快跟进'}
                </p>
              ) : disputingId === o.id ? (
                <div className="mt-3 border-t border-gray-50 pt-3">
                  <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={2}
                    placeholder="请描述纠纷情况（如：未按约定完成 / 收费不符 / 服务质量问题…）"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => raiseDispute(o.id)} disabled={submittingDispute}
                      className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60">
                      {submittingDispute ? '提交中…' : '提交纠纷'}
                    </button>
                    <button onClick={() => { setDisputingId(null); setDisputeReason('') }}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm">取消</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setDisputingId(o.id); setDisputeReason('') }}
                  className="mt-2 text-[11px] text-gray-400 hover:text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={11} /> 有问题？发起纠纷
                </button>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
