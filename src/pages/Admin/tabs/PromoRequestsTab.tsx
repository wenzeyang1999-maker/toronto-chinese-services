// ─── Admin · Promotion requests tab ──────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, ExternalLink } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type PromoRequestRow } from '../types'
import { useAdminContext } from '../AdminContext'

export default function PromoRequestsTab() {
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [promoRequests, setPromoRequests] = useState<PromoRequestRow[]>([])

  async function loadPromoRequests() {
    const { data, error } = await supabase
      .from('promo_requests')
      .select(`
        id, note, status, created_at, reviewed_at,
        service:service_id(id, title),
        provider:provider_id(id, name, email)
      `)
      .order('created_at', { ascending: false })
    if (error) { showNotice('error', `加载置顶申请失败：${error.message}`); return }
    if (data) {
      setPromoRequests(data.map((r: any) => ({
        ...r,
        service:  Array.isArray(r.service)  ? r.service[0]  : r.service,
        provider: Array.isArray(r.provider) ? r.provider[0] : r.provider,
      })))
    }
  }

  async function approvePromoRequest(row: PromoRequestRow, approved: boolean) {
    setActing(row.id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_approve_promo_request', {
        request_id: row.id,
        approved,
      })
      if (error) throw error
    }, approved ? '已批准置顶' : '已拒绝申请')
    if (ok !== null) {
      setPromoRequests(prev => prev.map(r =>
        r.id === row.id ? { ...r, status: approved ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() } : r
      ))
    }
    setActing(null)
  }

  useEffect(() => {
    void loadPromoRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
        <Zap size={15} className="text-amber-500" />
        <span className="text-sm text-gray-500 flex-1">
          共 <strong className="text-amber-600">{promoRequests.filter(r => r.status === 'pending').length}</strong> 条待审核
        </span>
        <button onClick={loadPromoRequests}
          className="text-xs text-primary-600 font-semibold hover:underline">刷新</button>
      </div>

      {promoRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
          暂无置顶申请
        </div>
      ) : (
        <div className="space-y-2">
          {promoRequests.map(row => (
            <div key={row.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 space-y-2
                ${row.status === 'pending' ? 'border-amber-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {row.service?.title ?? '未知服务'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {row.provider?.name ?? '—'} · {row.provider?.email ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">{row.created_at.slice(0, 10)} 申请</p>
                </div>
                <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  row.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                  row.status === 'approved' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {row.status === 'pending' ? '待审核' : row.status === 'approved' ? '已批准' : '已拒绝'}
                </span>
              </div>

              {row.note && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                  留言：{row.note}
                </p>
              )}

              {row.service?.id && (
                <a href={`/service/${row.service.id}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                  <ExternalLink size={11} /> 查看服务
                </a>
              )}

              {row.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => approvePromoRequest(row, true)}
                    disabled={acting === row.id}
                    className="flex-1 text-xs py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                    {acting === row.id ? '…' : <><Zap size={12} className="fill-white" /> 批准置顶</>}
                  </button>
                  <button
                    onClick={() => approvePromoRequest(row, false)}
                    disabled={acting === row.id}
                    className="flex-1 text-xs py-2 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 font-semibold disabled:opacity-50 transition-colors">
                    拒绝
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
