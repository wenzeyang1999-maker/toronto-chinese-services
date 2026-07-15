// DisputesTab — 纠纷工单队列（说明书 §5.2 AI 仲裁 · 人工终判）
// 展示：纠纷原因 + AI 初步意见 + 订单要素 + 双方聊天 + 完工存证照片，admin 终判。
import { useEffect, useState } from 'react'
import { AlertTriangle, Sparkles, ChevronDown } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from '../../../lib/toast'

interface DisputeRow {
  id: string
  order_id: string
  raised_by: string
  against_id: string
  reason: string
  status: string
  ai_opinion: string | null
  resolution: string | null
  created_at: string
}
interface DisputeContext {
  order: {
    title: string | null; amount: number | null; category_id: string | null
    status: string; completion_photos: string[] | null
    created_at: string; completed_at: string | null
  }
  client_id: string
  provider_id: string
  client_name: string | null
  provider_name: string | null
  raised_by: string
  chat: { sender_id: string; content: string; at: string }[]
}

const ST: Record<string, { label: string; cls: string }> = {
  open:      { label: '待处理', cls: 'bg-red-50 text-red-600 border-red-200' },
  reviewing: { label: '处理中', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved:  { label: '已处理', cls: 'bg-green-50 text-green-700 border-green-200' },
  dismissed: { label: '已关闭', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export default function DisputesTab() {
  const [rows, setRows]             = useState<DisputeRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [showAll, setShowAll]       = useState(false)
  const [openId, setOpenId]         = useState<string | null>(null)
  const [ctx, setCtx]               = useState<DisputeContext | null>(null)
  const [ctxLoading, setCtxLoading] = useState(false)
  const [resolution, setResolution] = useState('')
  const [acting, setActing]         = useState(false)

  async function load() {
    const { data, error } = await supabase.from('disputes').select('*').order('created_at', { ascending: false })
    if (error) toast(`加载纠纷失败：${error.message}`, 'error')
    setRows((data ?? []) as DisputeRow[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function toggle(id: string) {
    if (openId === id) { setOpenId(null); setCtx(null); return }
    setOpenId(id); setCtx(null); setCtxLoading(true); setResolution('')
    const { data, error } = await supabase.rpc('admin_dispute_context', { p_dispute_id: id })
    setCtxLoading(false)
    if (error) { toast(error.message, 'error'); return }
    setCtx(data as unknown as DisputeContext)
  }

  async function resolve(id: string, status: 'resolved' | 'dismissed') {
    setActing(true)
    const { error } = await supabase.rpc('admin_resolve_dispute', {
      p_dispute_id: id, p_status: status, p_resolution: resolution.trim() || null,
    })
    setActing(false)
    if (error) { toast(error.message, 'error'); return }
    toast(status === 'resolved' ? '已标记处理' : '已关闭纠纷', 'success')
    setOpenId(null); setCtx(null); void load()
  }

  const visible = rows.filter(r => showAll || r.status === 'open' || r.status === 'reviewing')

  if (loading) return <p className="py-10 text-center text-sm text-gray-400">加载中…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          待处理 <b className="text-red-600">{rows.filter(r => r.status === 'open' || r.status === 'reviewing').length}</b> 起
        </p>
        <label className="text-xs text-gray-500 flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          显示已处理
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <AlertTriangle size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无待处理纠纷</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((d) => {
            const st = ST[d.status] ?? ST.open
            const isOpen = openId === d.id
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">纠纷原因</p>
                      <p className="text-sm text-gray-600 mt-0.5">{d.reason}</p>
                      <p className="text-[11px] text-gray-300 mt-1">{new Date(d.created_at).toLocaleString('zh-CN')}</p>
                    </div>
                    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                  </div>

                  {d.ai_opinion && (
                    <div className="mt-3 rounded-xl bg-violet-50 border border-violet-100 p-3">
                      <p className="text-[11px] font-semibold text-violet-600 flex items-center gap-1 mb-1">
                        <Sparkles size={12} /> AI 初步参考意见（非约束，供人工参考）
                      </p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{d.ai_opinion}</p>
                    </div>
                  )}

                  {d.resolution && (
                    <p className="mt-2 text-xs text-gray-500"><b>终判：</b>{d.resolution}</p>
                  )}

                  <button onClick={() => toggle(d.id)}
                    className="mt-3 text-xs text-primary-600 flex items-center gap-1 hover:underline">
                    <ChevronDown size={13} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    {isOpen ? '收起' : '查看订单 · 聊天 · 完工照片'}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                    {ctxLoading || !ctx ? (
                      <p className="text-xs text-gray-400 text-center py-4">加载上下文…</p>
                    ) : (
                      <>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <p><b>订单：</b>{ctx.order.title || '（无标题）'}　类目：{ctx.order.category_id ?? '未知'}
                            {ctx.order.amount != null && <span className="text-primary-600 font-semibold ml-1">${ctx.order.amount}</span>}</p>
                          <p><b>客户：</b>{ctx.client_name ?? '—'}　<b>服务商：</b>{ctx.provider_name ?? '—'}
                            发起方：{ctx.raised_by === ctx.client_id ? '客户' : '服务商'}</p>
                        </div>

                        {ctx.order.completion_photos && ctx.order.completion_photos.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-gray-400 mb-1.5">完工存证照片</p>
                            <div className="flex gap-2 flex-wrap">
                              {ctx.order.completion_photos.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-white hover:opacity-90">
                                  <img loading="lazy" src={url} alt={`完工照 ${i + 1}`} className="w-full h-full object-cover" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-[11px] font-semibold text-gray-400 mb-1.5">双方聊天记录</p>
                          <div className="bg-white rounded-xl border border-gray-100 p-2 max-h-64 overflow-y-auto space-y-1.5">
                            {ctx.chat.length === 0 ? (
                              <p className="text-xs text-gray-300 text-center py-3">（无聊天记录）</p>
                            ) : ctx.chat.map((m, i) => {
                              const fromClient = m.sender_id === ctx.client_id
                              return (
                                <div key={i} className={`flex ${fromClient ? 'justify-start' : 'justify-end'}`}>
                                  <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs ${fromClient ? 'bg-gray-100 text-gray-700' : 'bg-primary-50 text-primary-800'}`}>
                                    <span className="text-[10px] text-gray-400 block">{fromClient ? '客户' : '服务商'}</span>
                                    {m.content}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {(d.status === 'open' || d.status === 'reviewing') && (
                          <div className="pt-1">
                            <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={2}
                              placeholder="终判说明（选填，会通知双方）"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => resolve(d.id, 'resolved')} disabled={acting}
                                className="flex-1 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-60">
                                标记已处理
                              </button>
                              <button onClick={() => resolve(d.id, 'dismissed')} disabled={acting}
                                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
                                关闭（不成立）
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
