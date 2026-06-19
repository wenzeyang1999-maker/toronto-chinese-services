// ─── Admin · Promoted listings tab ───────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type PromotedRow } from '../types'
import { useAdminContext } from '../AdminContext'

export default function PromotedTab() {
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [promoted,    setPromoted]    = useState<PromotedRow[]>([])
  const [promoSearch, setPromoSearch] = useState('')
  const [promoTable,  setPromoTable]  = useState<PromotedRow['table']>('services')

  async function searchPromoted() {
    const kw = promoSearch.trim()
    const query = supabase
      .from(promoTable)
      .select('id, title, is_promoted, created_at')
      .order('is_promoted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)
    if (kw) query.ilike('title', `%${kw}%`)
    const { data, error } = await query
    if (error) {
      showNotice('error', `加载推广列表失败：${error.message}`)
      return
    }
    setPromoted((data ?? []).map((r: any) => ({ ...r, table: promoTable })))
  }

  async function togglePromoted(row: PromotedRow) {
    setActing(row.id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_toggle_promoted', {
        item_id: row.id,
        table_name: row.table,
        promoted: !row.is_promoted,
      })
      if (error) throw error
    }, row.is_promoted ? '已取消推广' : '已设为推广')
    if (ok !== null) {
      setPromoted(prev => prev.map(r => r.id === row.id ? { ...r, is_promoted: !r.is_promoted } : r))
    }
    setActing(null)
  }

  // Reload whenever the selected table changes (also covers initial mount).
  useEffect(() => {
    void searchPromoted()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoTable])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Table selector + search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Table tabs */}
        <div className="flex gap-1 flex-wrap">
          {(['services','jobs','properties','secondhand','events'] as const).map(t => (
            <button key={t} onClick={() => setPromoTable(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                promoTable === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {{ services:'服务', jobs:'招聘', properties:'房源', secondhand:'闲置', events:'活动' }[t]}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="flex gap-2">
          <input
            value={promoSearch} onChange={e => setPromoSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchPromoted()}
            placeholder="搜索帖子标题（留空显示全部）"
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
          />
          <button onClick={searchPromoted}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors">
            搜索
          </button>
        </div>
      </div>

      {/* Results */}
      {promoted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
          点击搜索查看帖子
        </div>
      ) : (
        <div className="space-y-2">
          {promoted.map(row => (
            <div key={row.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3
                ${row.is_promoted ? 'border-amber-400 bg-amber-50/30' : 'border-gray-100'}`}>
              {row.is_promoted && (
                <Zap size={16} className="text-amber-500 fill-amber-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{row.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{row.created_at.slice(0,10)}</p>
              </div>
              <button
                onClick={() => togglePromoted(row)}
                disabled={acting === row.id}
                className={`flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                  row.is_promoted
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                }`}>
                {acting === row.id ? '…' : row.is_promoted ? '取消推广' : '设为推广'}
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
