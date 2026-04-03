// ─── My Posts Section (我的发布) ───────────────────────────────────────────────
// Shows all posts: services, jobs, properties, secondhand, events
// Tabs: 服务 | 招聘 | 房源 | 闲置 | 活动
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight,
  ImagePlus, Wrench, Briefcase, Home, ShoppingBag, Calendar, ChevronDown,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { compressImage, validateImageFile } from '../../../lib/compressImage'
import { JOB_CATEGORY_CONFIG, getCategoryLabel } from '../../Jobs/types'
import type { Job } from '../../Jobs/types'
import { LISTING_TYPE_CONFIG as RE_CONFIG, PROPERTY_TYPE_CONFIG, getPriceLabel as propPrice } from '../../RealEstate/types'
import type { Property } from '../../RealEstate/types'
import { SECONDHAND_CATEGORY_CONFIG, ITEM_CONDITION_CONFIG, getPriceLabel as itemPrice } from '../../Secondhand/types'
import type { SecondhandItem } from '../../Secondhand/types'
import { EVENT_TYPE_CONFIG, getPriceLabel as eventPrice, formatEventDate } from '../../Events/types'
import type { Event } from '../../Events/types'

type Tab = 'services' | 'jobs' | 'properties' | 'secondhand' | 'events'

interface ServiceItem {
  id: string; title: string; description: string; price: number | null
  price_type: string | null; area: string | null; category_id: string
  is_available: boolean; created_at: string; images: string[]
}

interface EditForm { title: string; description: string; price: string; area: string; images: string[] }

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'services',   label: '服务', icon: <Wrench      size={14} /> },
  { key: 'jobs',       label: '招聘', icon: <Briefcase   size={14} /> },
  { key: 'properties', label: '房源', icon: <Home        size={14} /> },
  { key: 'secondhand', label: '闲置', icon: <ShoppingBag size={14} /> },
  { key: 'events',     label: '活动', icon: <Calendar    size={14} /> },
]

export default function ServicesSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const imgRef   = useRef<HTMLInputElement>(null)

  const [tab,         setTab]         = useState<Tab>('services')
  const [services,    setServices]    = useState<ServiceItem[]>([])
  const [jobs,        setJobs]        = useState<Job[]>([])
  const [properties,  setProperties]  = useState<Property[]>([])
  const [secondhand,  setSecondhand]  = useState<SecondhandItem[]>([])
  const [events,      setEvents]      = useState<Event[]>([])
  const [loading,     setLoading]     = useState(true)
  const [confirmDel,  setConfirmDel]  = useState<string | null>(null)
  const [showPostMenu, setShowPostMenu] = useState(false)

  // Service edit state
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editForm,    setEditForm]    = useState<EditForm>({ title: '', description: '', price: '', area: '', images: [] })
  const [newImgFiles, setNewImgFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [saving,      setSaving]      = useState(false)

  function loadAll() {
    if (!user) return
    setLoading(true)

    supabase.from('services').select('id,title,description,price,price_type,area,category_id,is_available,created_at,images')
      .eq('provider_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setServices(data.map(r => ({ ...r, images: r.images ?? [] }))) })

    supabase.from('jobs').select('*').eq('poster_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setJobs(data.map(j => ({ ...j, listing_type: j.listing_type ?? 'hiring' })) as Job[]) })

    supabase.from('properties').select('*').eq('poster_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setProperties(data.map(p => ({ ...p, images: p.images ?? [] })) as Property[]) })

    supabase.from('secondhand').select('*').eq('seller_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSecondhand(data.map(i => ({ ...i, images: i.images ?? [] })) as SecondhandItem[]) })

    supabase.from('events').select('*').eq('poster_id', user.id).order('event_date', { ascending: true })
      .then(({ data }) => {
        if (data) setEvents(data.map(e => ({ ...e, images: e.images ?? [] })) as Event[])
        setLoading(false)
      })
  }

  useEffect(loadAll, [user])

  // ── Counts for tab badges ──────────────────────────────────────────────────
  const counts: Record<Tab, number> = {
    services:   services.length,
    jobs:       jobs.length,
    properties: properties.length,
    secondhand: secondhand.length,
    events:     events.length,
  }

  // ── Service edit helpers ───────────────────────────────────────────────────
  function startEdit(svc: ServiceItem) {
    setEditingId(svc.id)
    setEditForm({ title: svc.title, description: svc.description, price: svc.price?.toString() ?? '', area: svc.area ?? '', images: svc.images })
    setNewImgFiles([]); setNewPreviews([])
  }
  function cancelEdit() {
    setEditingId(null)
    newPreviews.forEach(URL.revokeObjectURL)
    setNewImgFiles([]); setNewPreviews([])
  }
  function handleImgAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const invalid = files.map(validateImageFile).filter(Boolean)
    if (invalid.length > 0) { alert(invalid.join('\n')); e.target.value = ''; return }
    const slots = 3 - editForm.images.length - newImgFiles.length
    const toAdd = files.slice(0, slots)
    setNewImgFiles(prev => [...prev, ...toAdd])
    setNewPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }
  async function saveEdit() {
    if (!editingId || !user) return
    setSaving(true)
    const uploaded: string[] = []
    for (const file of newImgFiles) {
      const compressed = await compressImage(file)
      const ext  = compressed.name.split('.').pop()
      const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('service-images').upload(path, compressed, { upsert: false })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('service-images').getPublicUrl(path)
        uploaded.push(publicUrl)
      }
    }
    await supabase.from('services').update({
      title: editForm.title.trim(), description: editForm.description.trim(),
      price: editForm.price ? parseFloat(editForm.price) : null,
      area: editForm.area.trim() || null, images: [...editForm.images, ...uploaded],
    }).eq('id', editingId)
    setSaving(false); cancelEdit(); loadAll()
  }

  // ── Toggle active / delete helpers ────────────────────────────────────────
  async function toggleService(svc: ServiceItem) {
    await supabase.from('services').update({ is_available: !svc.is_available }).eq('id', svc.id)
    setServices(prev => prev.map(s => s.id === svc.id ? { ...s, is_available: !s.is_available } : s))
  }
  async function toggleJob(job: Job) {
    await supabase.from('jobs').update({ is_active: !job.is_active }).eq('id', job.id)
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_active: !j.is_active } : j))
  }
  async function toggleProperty(p: Property) {
    await supabase.from('properties').update({ is_active: !p.is_active }).eq('id', p.id)
    setProperties(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
  }
  async function toggleSecondhand(item: SecondhandItem) {
    await supabase.from('secondhand').update({ is_active: !item.is_active }).eq('id', item.id)
    setSecondhand(prev => prev.map(x => x.id === item.id ? { ...x, is_active: !x.is_active } : x))
  }
  async function toggleEvent(ev: Event) {
    await supabase.from('events').update({ is_active: !ev.is_active }).eq('id', ev.id)
    setEvents(prev => prev.map(x => x.id === ev.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function deleteItem(table: string, id: string) {
    await supabase.from(table).delete().eq('id', id)
    if (table === 'services')   setServices(prev => prev.filter(x => x.id !== id))
    if (table === 'jobs')       setJobs(prev => prev.filter(x => x.id !== id))
    if (table === 'properties') setProperties(prev => prev.filter(x => x.id !== id))
    if (table === 'secondhand') setSecondhand(prev => prev.filter(x => x.id !== id))
    if (table === 'events')     setEvents(prev => prev.filter(x => x.id !== id))
    setConfirmDel(null)
  }

  // ── Shared row wrapper ─────────────────────────────────────────────────────
  function Row({
    id, table, title, subtitle, badge, active,
    onNavigate, onToggle, children,
  }: {
    id: string; table: string; title: string; subtitle?: string
    badge?: React.ReactNode; active: boolean
    onNavigate: () => void; onToggle: () => void
    children?: React.ReactNode
  }) {
    return (
      <motion.div key={id}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="px-4 py-3.5 flex items-center gap-3">
          <button onClick={onNavigate} className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity">
            {badge && <div className="mb-1">{badge}</div>}
            <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </button>
          <button onClick={onToggle}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 transition-colors
              ${active ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
            {active ? <><ToggleRight size={13} />上架中</> : <><ToggleLeft size={13} />已下架</>}
          </button>
          <button onClick={() => setConfirmDel(id)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0">
            <Trash2 size={16} />
          </button>
        </div>
        {children}
        <AnimatePresence>
          {confirmDel === id && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="border-t border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-red-600">确定要删除吗？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(null)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">取消</button>
                <button onClick={() => deleteItem(table, id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600">删除</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">加载中…</div>

  const totalSlots = editForm.images.length + newImgFiles.length

  return (
    <div className="relative flex-1 px-4 py-5 max-w-md lg:max-w-none mx-auto w-full">

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4 overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setConfirmDel(null); cancelEdit() }}
            className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}{t.label}
            {counts[t.key] > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === t.key ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-500'
              }`}>{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

          {/* SERVICES */}
          {tab === 'services' && (
            <div className="space-y-3">
              {services.length === 0 && <Empty label="还没有发布过服务" action={() => navigate('/post')} actionLabel="发布服务" />}
              <AnimatePresence>
                {services.map(svc => (
                  <motion.div key={svc.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {editingId !== svc.id ? (
                      <>
                        {svc.images.length > 0 && (
                          <button onClick={() => navigate(`/service/${svc.id}`)}
                            className="flex gap-1.5 px-4 pt-3 hover:opacity-70 transition-opacity w-full text-left">
                            {svc.images.slice(0, 3).map((url, i) => (
                              <img key={i} src={url} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-100" />
                            ))}
                          </button>
                        )}
                        <div className="px-4 py-3.5 flex items-center gap-3">
                          <button onClick={() => navigate(`/service/${svc.id}`)}
                            className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity">
                            <p className="text-sm font-semibold text-gray-800 truncate">{svc.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{svc.created_at.slice(0, 10)}</p>
                          </button>
                          <button onClick={() => toggleService(svc)}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 transition-colors
                              ${svc.is_available ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                            {svc.is_available ? <><ToggleRight size={13} />上架中</> : <><ToggleLeft size={13} />已下架</>}
                          </button>
                          <button onClick={() => startEdit(svc)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => setConfirmDel(svc.id)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="px-4 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide">编辑服务</span>
                          <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-2 block">图片（最多 3 张）</label>
                          <div className="flex flex-wrap gap-2">
                            {editForm.images.map((url, i) => (
                              <div key={`ex-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                                <button type="button" onClick={() => setEditForm(f => ({ ...f, images: f.images.filter(u => u !== url) }))}
                                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white">
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                            {newPreviews.map((src, i) => (
                              <div key={`new-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-blue-200 flex-shrink-0">
                                <img src={src} alt="" className="w-full h-full object-cover" />
                                <button type="button" onClick={() => { URL.revokeObjectURL(newPreviews[i]); setNewImgFiles(p => p.filter((_,j) => j !== i)); setNewPreviews(p => p.filter((_,j) => j !== i)) }}
                                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white">
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                            {totalSlots < 3 && (
                              <button type="button" onClick={() => imgRef.current?.click()}
                                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors flex-shrink-0">
                                <ImagePlus size={18} /><span className="text-xs">添加</span>
                              </button>
                            )}
                          </div>
                          <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImgAdd} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">标题</label>
                          <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">描述</label>
                          <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 mb-1 block">价格 ($)</label>
                            <input type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                              placeholder="留空表示面议"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 mb-1 block">服务区域</label>
                            <input value={editForm.area} onChange={e => setEditForm(f => ({ ...f, area: e.target.value }))}
                              placeholder="如 North York"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={cancelEdit}
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">取消</button>
                          <button onClick={saveEdit} disabled={saving || !editForm.title.trim()}
                            className="flex-1 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-1">
                            <Check size={14} />{saving ? '保存中…' : '保存'}
                          </button>
                        </div>
                      </div>
                    )}
                    <AnimatePresence>
                      {confirmDel === svc.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="border-t border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between">
                          <p className="text-sm text-red-600">确定要删除「{svc.title}」吗？</p>
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmDel(null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500">取消</button>
                            <button onClick={() => deleteItem('services', svc.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white">删除</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* JOBS */}
          {tab === 'jobs' && (
            <div className="space-y-3">
              {jobs.length === 0 && <Empty label="还没有发布过职位" action={() => navigate('/jobs/post')} actionLabel="发布职位" />}
              <AnimatePresence>
                {jobs.map(job => (
                  <Row key={job.id} id={job.id} table="jobs" title={job.title}
                    subtitle={job.created_at.slice(0, 10)}
                    badge={
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-600">
                          {job.listing_type === 'hiring' ? '💼 招聘' : '🙋 求职'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {JOB_CATEGORY_CONFIG[job.category].emoji} {getCategoryLabel(job)}
                        </span>
                      </div>
                    }
                    active={job.is_active}
                    onNavigate={() => navigate(`/jobs/${job.id}`)}
                    onToggle={() => toggleJob(job)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* PROPERTIES */}
          {tab === 'properties' && (
            <div className="space-y-3">
              {properties.length === 0 && <Empty label="还没有发布过房源" action={() => navigate('/realestate/post')} actionLabel="发布房源" />}
              <AnimatePresence>
                {properties.map(p => (
                  <Row key={p.id} id={p.id} table="properties" title={p.title}
                    subtitle={p.created_at.slice(0, 10)}
                    badge={
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RE_CONFIG[p.listing_type].color}`}>
                          {RE_CONFIG[p.listing_type].label}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {PROPERTY_TYPE_CONFIG[p.property_type].emoji} {PROPERTY_TYPE_CONFIG[p.property_type].label}
                        </span>
                        <span className="text-[10px] font-bold text-primary-600">{propPrice(p)}</span>
                      </div>
                    }
                    active={p.is_active}
                    onNavigate={() => navigate(`/realestate/${p.id}`)}
                    onToggle={() => toggleProperty(p)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* SECONDHAND */}
          {tab === 'secondhand' && (
            <div className="space-y-3">
              {secondhand.length === 0 && <Empty label="还没有发布过闲置" action={() => navigate('/secondhand/post')} actionLabel="发布闲置" />}
              <AnimatePresence>
                {secondhand.map(item => (
                  <Row key={item.id} id={item.id} table="secondhand" title={item.title}
                    subtitle={item.created_at.slice(0, 10)}
                    badge={
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400">
                          {SECONDHAND_CATEGORY_CONFIG[item.category].emoji} {SECONDHAND_CATEGORY_CONFIG[item.category].label}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ITEM_CONDITION_CONFIG[item.condition].color}`}>
                          {ITEM_CONDITION_CONFIG[item.condition].label}
                        </span>
                        <span className="text-[10px] font-bold text-primary-600">{itemPrice(item)}</span>
                        {item.is_sold && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">已售出</span>}
                      </div>
                    }
                    active={item.is_active && !item.is_sold}
                    onNavigate={() => navigate(`/secondhand/${item.id}`)}
                    onToggle={() => toggleSecondhand(item)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* EVENTS */}
          {tab === 'events' && (
            <div className="space-y-3">
              {events.length === 0 && <Empty label="还没有发布过活动" action={() => navigate('/events/post')} actionLabel="发布活动" />}
              <AnimatePresence>
                {events.map(ev => {
                  const cfg = EVENT_TYPE_CONFIG[ev.event_type]
                  return (
                    <Row key={ev.id} id={ev.id} table="events" title={ev.title}
                      subtitle={formatEventDate(ev.event_date)}
                      badge={
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                            {cfg.emoji} {cfg.label}
                          </span>
                          <span className="text-[10px] font-bold text-green-600">{eventPrice(ev)}</span>
                        </div>
                      }
                      active={ev.is_active}
                      onNavigate={() => navigate(`/events/${ev.id}`)}
                      onToggle={() => toggleEvent(ev)}
                    />
                  )
                })}
              </AnimatePresence>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ── FAB with post menu ───────────────────────────────────────────── */}
      <div className="fixed bottom-24 right-8 lg:bottom-32 lg:right-16 z-30">
        <AnimatePresence>
          {showPostMenu && (
            <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-44"
            >
              {[
                { label: '发布服务',  path: '/post',              icon: '🔧' },
                { label: '发布招聘',  path: '/jobs/post?type=hiring',   icon: '💼' },
                { label: '发布求职',  path: '/jobs/post?type=seeking',  icon: '🙋' },
                { label: '发布房源',  path: '/realestate/post',   icon: '🏠' },
                { label: '发布闲置',  path: '/secondhand/post',   icon: '🛒' },
                { label: '发布活动',  path: '/events/post',       icon: '🎉' },
              ].map(item => (
                <button key={item.path} onClick={() => { setShowPostMenu(false); navigate(item.path) }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0">
                  <span>{item.icon}</span>{item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowPostMenu(v => !v)}
          className="w-14 h-14 lg:w-auto lg:h-auto lg:px-6 lg:py-3.5 lg:rounded-2xl
                     bg-primary-600 hover:bg-primary-700 active:scale-95
                     text-white rounded-full shadow-xl flex items-center justify-center gap-2 transition-all"
        >
          <Plus size={22} />
          <span className="hidden lg:inline text-sm font-semibold">发布新内容</span>
          <ChevronDown size={16} className="hidden lg:inline" />
        </button>
      </div>

      {/* Click outside to close menu */}
      {showPostMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowPostMenu(false)} />
      )}
    </div>
  )
}

function Empty({ label, action, actionLabel }: { label: string; action: () => void; actionLabel: string }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
      <p className="text-sm text-gray-500 mb-4">{label}</p>
      <button onClick={action}
        className="bg-primary-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors">
        {actionLabel}
      </button>
    </div>
  )
}
