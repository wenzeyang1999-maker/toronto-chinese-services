// ─── My Services Section ──────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight, ImagePlus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { compressImage, validateImageFile } from '../../../lib/compressImage'

interface ServiceItem {
  id: string
  title: string
  description: string
  price: number | null
  price_type: string | null
  area: string | null
  category_id: string
  is_available: boolean
  created_at: string
  images: string[]
}

interface EditForm {
  title: string
  description: string
  price: string
  area: string
  images: string[]       // existing image URLs kept
}

export default function ServicesSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const imgRef   = useRef<HTMLInputElement>(null)

  const [services,    setServices]    = useState<ServiceItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editForm,    setEditForm]    = useState<EditForm>({ title: '', description: '', price: '', area: '', images: [] })
  const [newImgFiles, setNewImgFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [saving,      setSaving]      = useState(false)
  const [confirmDel,  setConfirmDel]  = useState<string | null>(null)

  function load() {
    if (!user) return
    supabase
      .from('services')
      .select('id, title, description, price, price_type, area, category_id, is_available, created_at, images')
      .eq('provider_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setServices(data.map(r => ({ ...r, images: r.images ?? [] })))
        setLoading(false)
      })
  }

  useEffect(load, [user])

  function startEdit(svc: ServiceItem) {
    setEditingId(svc.id)
    setEditForm({ title: svc.title, description: svc.description, price: svc.price?.toString() ?? '', area: svc.area ?? '', images: svc.images })
    setNewImgFiles([])
    setNewPreviews([])
  }

  function cancelEdit() {
    setEditingId(null)
    newPreviews.forEach(url => URL.revokeObjectURL(url))
    setNewImgFiles([])
    setNewPreviews([])
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

  function removeExistingImg(url: string) {
    setEditForm(f => ({ ...f, images: f.images.filter(u => u !== url) }))
  }

  function removeNewImg(index: number) {
    URL.revokeObjectURL(newPreviews[index])
    setNewImgFiles(prev => prev.filter((_, i) => i !== index))
    setNewPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function saveEdit() {
    if (!editingId || !user) return
    setSaving(true)

    // Upload new images (compress first if needed)
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

    const allImages = [...editForm.images, ...uploaded]

    await supabase.from('services').update({
      title:       editForm.title.trim(),
      description: editForm.description.trim(),
      price:       editForm.price ? parseFloat(editForm.price) : null,
      area:        editForm.area.trim() || null,
      images:      allImages,
    }).eq('id', editingId)

    setSaving(false)
    cancelEdit()
    load()
  }

  async function toggleAvailable(svc: ServiceItem) {
    await supabase.from('services').update({ is_available: !svc.is_available }).eq('id', svc.id)
    setServices(prev => prev.map(s => s.id === svc.id ? { ...s, is_available: !s.is_available } : s))
  }

  async function deleteService(id: string) {
    await supabase.from('services').delete().eq('id', id)
    setServices(prev => prev.filter(s => s.id !== id))
    setConfirmDel(null)
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">加载中…</div>
  }

  const totalSlots = editForm.images.length + newImgFiles.length

  return (
    <div className="relative flex-1 px-4 py-6 max-w-md lg:max-w-none mx-auto w-full">

      {services.length === 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
          <Briefcase size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">还没有发布过服务</p>
          <button onClick={() => navigate('/post')}
            className="mt-4 bg-primary-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors">
            立即发布
          </button>
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence>
          {services.map(svc => (
            <motion.div key={svc.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* ── Normal view ── */}
              {editingId !== svc.id && (
                <>
                  {/* Thumbnail strip */}
                  {svc.images.length > 0 && (
                    <div className="flex gap-1.5 px-5 pt-4">
                      {svc.images.slice(0, 3).map((url, i) => (
                        <img key={i} src={url} alt=""
                          className="w-16 h-16 rounded-xl object-cover border border-gray-100" />
                      ))}
                    </div>
                  )}
                  <div className="px-5 py-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{svc.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{svc.created_at.slice(0, 10)}</p>
                    </div>
                    <button onClick={() => toggleAvailable(svc)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 transition-colors
                        ${svc.is_available ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                      {svc.is_available ? <><ToggleRight size={13} />上架中</> : <><ToggleLeft size={13} />已下架</>}
                    </button>
                    <button onClick={() => startEdit(svc)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setConfirmDel(svc.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              )}

              {/* ── Edit form ── */}
              {editingId === svc.id && (
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide">编辑服务</span>
                    <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  </div>

                  {/* Images */}
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">图片（最多 3 张）</label>
                    <div className="flex flex-wrap gap-2">
                      {/* Existing images */}
                      {editForm.images.map((url, i) => (
                        <div key={`ex-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeExistingImg(url)}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {/* New image previews */}
                      {newPreviews.map((src, i) => (
                        <div key={`new-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-blue-200 flex-shrink-0">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeNewImg(i)}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {/* Add button */}
                      {totalSlots < 3 && (
                        <button type="button" onClick={() => imgRef.current?.click()}
                          className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors flex-shrink-0">
                          <ImagePlus size={18} />
                          <span className="text-xs">添加</span>
                        </button>
                      )}
                    </div>
                    <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImgAdd} />
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">标题</label>
                    <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">描述</label>
                    <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>

                  {/* Price + Area */}
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

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={cancelEdit}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                      取消
                    </button>
                    <button onClick={saveEdit} disabled={saving || !editForm.title.trim()}
                      className="flex-1 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1">
                      <Check size={14} />
                      {saving ? '保存中…' : '保存'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Delete confirmation ── */}
              <AnimatePresence>
                {confirmDel === svc.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="border-t border-red-100 bg-red-50 px-5 py-3 flex items-center justify-between">
                    <p className="text-sm text-red-600">确定要删除「{svc.title}」吗？</p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setConfirmDel(null)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">取消</button>
                      <button onClick={() => deleteService(svc.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600">删除</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* FAB */}
      <button onClick={() => navigate('/post')}
        className="fixed bottom-24 right-8 w-14 h-14 lg:w-auto lg:h-auto lg:px-8 lg:py-4 lg:rounded-2xl lg:right-16 lg:bottom-32
                   bg-primary-600 hover:bg-primary-700 active:scale-95
                   text-white rounded-full shadow-xl flex items-center justify-center gap-2 transition-all z-30"
        aria-label="发布新服务">
        <Plus size={22} />
        <span className="hidden lg:inline text-sm font-semibold">发布新服务</span>
      </button>
    </div>
  )
}
