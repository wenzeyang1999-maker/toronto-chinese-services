// ─── 商家收录(admin/boss)────────────────────────────────────────────────────
// 录入从网上收集的华人商家 → directory_merchants,前台以「待认领」展示,商家注册后可认领。
import { useEffect, useState } from 'react'
import { BookMarked, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from '../../../lib/toast'
import { CATEGORIES } from '../../../data/categories'

interface DirRow {
  id: string
  name: string
  category_id: string | null
  area: string | null
  phone: string | null
  wechat: string | null
  bio: string | null
  source_url: string | null
  is_published: boolean
  claimed_by: string | null
  created_at: string
}

const EMPTY = { name: '', category_id: '', area: '', phone: '', wechat: '', avatar_url: '', bio: '', source_url: '' }

export default function MerchantDirectoryAdmin() {
  const [rows, setRows] = useState<DirRow[]>([])
  const [form, setForm] = useState({ ...EMPTY })
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadRows() {
    const { data } = await supabase
      .from('directory_merchants')
      .select('id,name,category_id,area,phone,wechat,bio,source_url,is_published,claimed_by,created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setRows(data as DirRow[])
  }
  useEffect(() => { void loadRows() }, [])

  async function submit() {
    if (!form.name.trim()) { toast('请填写商家名称', 'error'); return }
    setSaving(true)
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim() === '' ? null : v.trim()]),
    )
    const { error } = await supabase.from('directory_merchants').insert(payload)
    setSaving(false)
    if (error) { toast('录入失败：' + error.message, 'error'); return }
    toast('已录入', 'success')
    setForm({ ...EMPTY })
    void loadRows()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('directory_merchants').delete().eq('id', id)
    if (error) { toast('删除失败：' + error.message, 'error'); return }
    setRows((r) => r.filter((x) => x.id !== id))
  }

  const inp = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-primary-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BookMarked size={15} className="text-amber-600" />
          <h3 className="text-sm font-bold text-gray-700">
            商家收录
            <span className="ml-1.5 text-xs font-semibold text-amber-600">{rows.length} 家</span>
          </h3>
        </div>
        <button onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 border border-primary-200 rounded-xl px-3 py-1.5 hover:bg-primary-50">
          <Plus size={13} /> 录入商家
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mb-2">从网上收集的华人商家,前台以「待认领」展示,商家注册后可认领完善。</p>

      {open && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} placeholder="商家名称 *" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className={inp} value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">选择类别</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.postLabel}</option>)}
            </select>
            <input className={inp} placeholder="地区(如 士嘉堡)" value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })} />
            <input className={inp} placeholder="电话(仅后台可见)" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={inp} placeholder="微信(仅后台可见)" value={form.wechat}
              onChange={(e) => setForm({ ...form, wechat: e.target.value })} />
            <input className={inp} placeholder="头像图片 URL" value={form.avatar_url}
              onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
          </div>
          <input className={inp} placeholder="一句话简介" value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <input className={inp} placeholder="收录来源链接(小红书/点评/官网)" value={form.source_url}
            onChange={(e) => setForm({ ...form, source_url: e.target.value })} />
          <button onClick={submit} disabled={saving}
            className="w-full rounded-xl bg-primary-600 text-white text-sm font-semibold py-2 hover:bg-primary-700 disabled:opacity-50">
            {saving ? '录入中…' : '录入'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">还没有收录商家 —— 点「录入商家」开始</p>
        ) : rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-xs">
              {r.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
              <p className="text-[11px] text-gray-400 truncate">
                {[r.area, r.phone || r.wechat].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            {r.claimed_by ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                <CheckCircle2 size={11} /> 已认领
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0">待认领</span>
            )}
            <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
