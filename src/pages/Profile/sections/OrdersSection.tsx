import { useEffect, useState } from 'react'
import { Store } from 'lucide-react'
import { useAuthStore } from '../../../store/authStore'
import { supabase } from '../../../lib/supabase'
import { toast } from '../../../lib/toast'

interface OrderRow {
  id: string
  client_id: string
  provider_id: string
  title: string | null
  amount: number | null
  status: string
  created_by: string
  created_at: string
  client:   { name: string | null } | null
  provider: { name: string | null } | null
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: '待确认', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: '已成交', cls: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: '已完成', cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: '已取消', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export default function OrdersSection() {
  const user = useAuthStore((s) => s.user)
  const [orders, setOrders]   = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState<string | null>(null)

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from('orders')
      .select('*, client:client_id(name), provider:provider_id(name)')
      .or(`client_id.eq.${user.id},provider_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    setOrders((data ?? []) as OrderRow[])
    setLoading(false)
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

  if (loading) return <p className="py-10 text-center text-sm text-gray-400">加载中…</p>
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
              <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
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
          </div>
        )
      })}
    </div>
  )
}
