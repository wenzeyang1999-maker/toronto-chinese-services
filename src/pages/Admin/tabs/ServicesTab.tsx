// ─── Admin · Service review tab ──────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, ExternalLink, Pencil, CheckCircle2, Zap } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type NewServiceRow } from '../types'
import { useAdminContext } from '../AdminContext'

const PAGE = 40

export default function ServicesTab() {
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [newServices,    setNewServices]    = useState<NewServiceRow[]>([])
  const [selectedSvcs,   setSelectedSvcs]   = useState<Set<string>>(new Set())
  const [editingSvcId,   setEditingSvcId]   = useState<string | null>(null)
  const [editTitle,      setEditTitle]      = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPrice,      setEditPrice]      = useState('')
  const [svcStatusFilter,   setSvcStatusFilter]   = useState<'all' | 'online' | 'offline'>('all')
  const [svcCategoryFilter, setSvcCategoryFilter] = useState('all')
  const [servicesHasMore,   setServicesHasMore]   = useState(false)

  async function loadNewServices(append = false) {
    const start = append ? newServices.length : 0
    const { data, error } = await supabase
      .from('services')
      .select('id, title, description, price, category_id, is_available, is_promoted, created_at, provider:provider_id(id, name, email)')
      .order('created_at', { ascending: false })
      .range(start, start + PAGE - 1)
    if (error) {
      showNotice('error', `加载服务审核列表失败：${error.message}`)
      return
    }
    const mapped = (data ?? []).map((r: any) => ({
      ...r,
      provider: Array.isArray(r.provider) ? r.provider[0] : r.provider,
    }))
    if (append) setNewServices(prev => [...prev, ...mapped])
    else setNewServices(mapped)
    setServicesHasMore((data ?? []).length === PAGE)
  }

  async function takedownService(id: string) {
    setActing(id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_service_availability', {
        service_id: id,
        available: false,
      })
      if (error) throw error
    }, '服务已下架')
    if (ok !== null) {
      setNewServices(prev => prev.map(s => s.id === id ? { ...s, is_available: false } : s))
      setSelectedSvcs(prev => { const n = new Set(prev); n.delete(id); return n })
    }
    setActing(null)
  }

  async function restoreService(id: string) {
    setActing(id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_service_availability', {
        service_id: id,
        available: true,
      })
      if (error) throw error
    }, '服务已恢复上线')
    if (ok !== null) {
      setNewServices(prev => prev.map(s => s.id === id ? { ...s, is_available: true } : s))
    }
    setActing(null)
  }

  async function bulkTakedown() {
    if (selectedSvcs.size === 0) return
    if (!confirm(`确定下架选中的 ${selectedSvcs.size} 条服务？`)) return
    const ids = Array.from(selectedSvcs)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_bulk_set_service_availability', {
        service_ids: ids,
        available: false,
      })
      if (error) throw error
    }, `已批量下架 ${ids.length} 条服务`)
    if (ok !== null) {
      setNewServices(prev => prev.map(s => ids.includes(s.id) ? { ...s, is_available: false } : s))
      setSelectedSvcs(new Set())
    }
  }

  function startEditService(svc: NewServiceRow) {
    setEditingSvcId(svc.id)
    setEditTitle(svc.title)
    setEditDescription(svc.description)
    setEditPrice(svc.price?.toString() ?? '')
  }

  function cancelEditService() {
    setEditingSvcId(null)
    setEditTitle('')
    setEditDescription('')
    setEditPrice('')
  }

  async function saveServiceEdit() {
    if (!editingSvcId) return
    setActing(editingSvcId)
    const id = editingSvcId
    const newPrice = editPrice.trim() === '' ? null : Number(editPrice)
    if (newPrice !== null && (isNaN(newPrice) || newPrice < 0)) {
      showNotice('error', '价格必须是非负数字')
      setActing(null)
      return
    }
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_update_service_content', {
        service_id: id,
        new_title: editTitle.trim(),
        new_description: editDescription.trim(),
        new_price: newPrice,
      })
      if (error) throw error
    }, '服务内容已更新')
    if (ok !== null) {
      setNewServices(prev => prev.map(s =>
        s.id === id ? { ...s, title: editTitle.trim(), description: editDescription.trim(), price: newPrice } : s
      ))
      cancelEditService()
    }
    setActing(null)
  }

  function toggleSelect(id: string) {
    setSelectedSvcs(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    const available = newServices.filter(s => s.is_available).map(s => s.id)
    if (selectedSvcs.size === available.length) {
      setSelectedSvcs(new Set())
    } else {
      setSelectedSvcs(new Set(available))
    }
  }

  useEffect(() => {
    void loadNewServices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = newServices.filter(svc => {
    if (svcStatusFilter === 'online' && !svc.is_available) return false
    if (svcStatusFilter === 'offline' && svc.is_available) return false
    if (svcCategoryFilter !== 'all' && svc.category_id !== svcCategoryFilter) return false
    return true
  })

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 flex-1">
          共 <strong>{newServices.length}</strong> 条 · 在线 <strong className="text-green-600">{newServices.filter(s => s.is_available).length}</strong> · 已下架 <strong className="text-gray-400">{newServices.filter(s => !s.is_available).length}</strong>
        </span>
        {selectedSvcs.size > 0 && (
          <button
            onClick={bulkTakedown}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Trash2 size={14} /> 批量下架 ({selectedSvcs.size})
          </button>
        )}
        <button
          onClick={toggleSelectAll}
          className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
        >
          {selectedSvcs.size === newServices.filter(s => s.is_available).length && newServices.filter(s => s.is_available).length > 0
            ? '取消全选' : '全选在线'}
        </button>
        <button onClick={() => loadNewServices()}
          className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
          刷新
        </button>
      </div>

      {/* Filter chips */}
      {newServices.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          {(['all', 'online', 'offline'] as const).map(f => (
            <button key={f} onClick={() => setSvcStatusFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                svcStatusFilter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {{ all: '全部', online: '在线', offline: '已下架' }[f]}
            </button>
          ))}
          <span className="text-gray-300">|</span>
          <select
            value={svcCategoryFilter}
            onChange={e => setSvcCategoryFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="all">全部分类</option>
            {Array.from(new Set(newServices.map(s => s.category_id))).sort().map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      )}

      {/* Service list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
          暂无服务记录
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(svc => (
            <div
              key={svc.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
                !svc.is_available
                  ? 'border-gray-100 opacity-50'
                  : selectedSvcs.has(svc.id)
                  ? 'border-red-300 bg-red-50/40'
                  : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox — only for online services */}
                {svc.is_available && (
                  <input
                    type="checkbox"
                    checked={selectedSvcs.has(svc.id)}
                    onChange={() => toggleSelect(svc.id)}
                    className="mt-1 accent-red-500 w-4 h-4 flex-shrink-0 cursor-pointer"
                  />
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">{svc.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{svc.category_id}</span>
                    {svc.is_promoted && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                        <Zap size={10} /> 推广
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      svc.is_available ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {svc.is_available ? '在线' : '已下架'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{svc.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {svc.provider?.name ?? '未知'} · {svc.provider?.email ?? ''}
                    <span className="ml-2 text-gray-300">{svc.created_at.slice(0, 10)}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <a
                    href={`/service/${svc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors"
                    title="查看详情"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={() => startEditService(svc)}
                    disabled={acting === svc.id || editingSvcId === svc.id}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                    title="编辑内容"
                  >
                    <Pencil size={14} />
                  </button>
                  {svc.is_available ? (
                    <button
                      onClick={() => takedownService(svc.id)}
                      disabled={acting === svc.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={12} /> 下架
                    </button>
                  ) : (
                    <button
                      onClick={() => restoreService(svc.id)}
                      disabled={acting === svc.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} /> 恢复
                    </button>
                  )}
                </div>
              </div>

              {/* Inline edit form */}
              {editingSvcId === svc.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">标题</label>
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">描述</label>
                    <textarea
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      rows={3}
                      maxLength={500}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">价格（留空保持不变）</label>
                    <input
                      type="number"
                      min="0"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      placeholder={svc.price?.toString() ?? '面议'}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={cancelEditService}
                      className="flex-1 text-xs py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveServiceEdit}
                      disabled={acting === svc.id || !editTitle.trim() || !editDescription.trim()}
                      className="flex-1 text-xs py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                      {acting === svc.id ? '保存中…' : '保存'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {servicesHasMore && (svcStatusFilter === 'all' && svcCategoryFilter === 'all') && (
        <button
          onClick={() => loadNewServices(true)}
          className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
        >
          加载更多
        </button>
      )}
    </motion.div>
  )
}
