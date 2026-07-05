import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Clock, MapPin, ChevronDown, Sparkles, Pencil } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { supabase } from '../../lib/supabase'
import { CATEGORIES } from '../../data/categories'
import { TORONTO_AREAS } from '../../data/torontoAreas'
import type { ServiceCategory } from '../../types'
import Header from '../../components/Header/Header'
import { toast } from '../../lib/toast'
import { moderateContent } from '../../hooks/useContentModeration'
import { toDatetimeLocal } from '../../lib/formatRequestTime'

const EXPIRY_OPTIONS = [
  { label: '1 天', days: 1 },
  { label: '3 天', days: 3 },
  { label: '5 天', days: 5 },
  { label: '7 天', days: 7 },
]

// Quick-tag prefill (drives title prefix + expiry default) — set from the
// home-page "1分钟发布需求" card.
const URGENCY_PRESETS: Record<string, { prefix: string; days: number }> = {
  urgent:   { prefix: '[紧急] ', days: 1 },
  today:    { prefix: '[今天] ', days: 1 },
  week:     { prefix: '[本周] ', days: 7 },
  flexible: { prefix: '',         days: 7 },
}

export default function PostRequest() {
  const navigate   = useNavigate()
  const [searchParams] = useSearchParams()
  const urgency    = searchParams.get('urgency') ?? ''
  const preset     = URGENCY_PRESETS[urgency]

  const user       = useAuthStore((s) => s.user)
  const addServiceRequest = useAppStore((s) => s.addServiceRequest)

  const [title,    setTitle]    = useState(preset?.prefix ?? '')
  const [category, setCategory] = useState<ServiceCategory>('other')
  const [catMode,  setCatMode]  = useState<'basic' | 'all' | 'custom'>('basic')
  const [customCat, setCustomCat] = useState('')
  const [desc,     setDesc]     = useState('')
  const [area,     setArea]     = useState('')
  const [budget,   setBudget]   = useState('')
  const [days,     setDays]     = useState(preset?.days ?? 3)
  const [startAt,  setStartAt]  = useState('')   // datetime-local string
  const [endAt,    setEndAt]    = useState('')
  const [shareLocation, setShareLocation] = useState(true)
  const [locCoords, setLocCoords]         = useState<{ lat: number; lng: number } | null>(null)
  const [locError,  setLocError]          = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extracted,  setExtracted] = useState<{
    category: string | null
    timing: string | null
    location_from: string | null
    location_to: string | null
    special_notes: string | null
    items: string | null
  } | null>(null)
  // Guards against double-submission while the moderation + insert chain is in
  // flight — React state lags a frame behind, so a quick double-tap can fire
  // handleSubmit twice before `loading` is true.
  const submittingRef = useRef(false)

  // Min selectable time = now (rounded down to the minute). Stops users from
  // picking a service time in the past.
  const minDatetime = useMemo(() => toDatetimeLocal(new Date()), [])

  // Auto-request location on mount since default is checked
  useEffect(() => { toggleShareLocation(true) }, [])   

  function toggleShareLocation(checked: boolean) {
    setShareLocation(checked)
    setLocError(null)
    if (!checked) { setLocCoords(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Privacy: never plot the real address. Shift the point a random
        // 300–900 m in a random direction, THEN round to 3 decimals (~110 m
        // grid). The offset guarantees the marker sits a few blocks off the
        // true location; the rounding strips residual precision. Computed once
        // here so the stored point is stable for every viewer.
        const R = 6_371_000                              // earth radius (m)
        const dist = 300 + Math.random() * 600           // 300–900 m away
        const bearing = Math.random() * 2 * Math.PI      // random direction
        const dLat = (dist * Math.cos(bearing)) / R
        const dLng = (dist * Math.sin(bearing)) / (R * Math.cos(pos.coords.latitude * Math.PI / 180))
        const rawLat = pos.coords.latitude  + dLat * 180 / Math.PI
        const rawLng = pos.coords.longitude + dLng * 180 / Math.PI
        const lat = Math.round(rawLat * 1000) / 1000
        const lng = Math.round(rawLng * 1000) / 1000
        setLocCoords({ lat, lng })
      },
      () => { setLocError('无法获取位置，请检查浏览器定位权限'); setShareLocation(false) },
      { timeout: 8000 },
    )
  }

  async function handleExtract() {
    const text = [title.trim(), desc.trim()].filter(Boolean).join(' ')
    if (!text || text.length < 5) return
    setExtracting(true)
    setExtracted(null)
    try {
      const { data, error } = await supabase.functions.invoke('extract-inquiry', {
        body: { text },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setExtracted(data)
      // Auto-fill category if matched
      if (data?.category && data.category !== 'other') {
        const matched = CATEGORIES.find(c => c.id === data.category)
        if (matched) setCategory(matched.id as ServiceCategory)
      }
    } catch {
      toast('AI 解析失败，请手动填写', 'error')
    } finally {
      setExtracting(false)
    }
  }

  function EditableChip({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const [editing, setEditing] = useState(false)
    if (editing) {
      return (
        <div className="flex items-center gap-1 bg-primary-50 border border-primary-300 rounded-xl px-2 py-1">
          <span className="text-[10px] text-primary-500 font-medium whitespace-nowrap">{label}</span>
          <input autoFocus value={value} onChange={e => onChange(e.target.value)}
            onBlur={() => setEditing(false)} onKeyDown={e => e.key === 'Enter' && setEditing(false)}
            className="text-xs text-gray-800 bg-transparent outline-none w-24 border-b border-primary-300" />
        </div>
      )
    }
    return (
      <button type="button" onClick={() => setEditing(true)}
        className="flex items-center gap-1 bg-primary-50 border border-primary-200 rounded-xl px-2.5 py-1 hover:border-primary-400 transition-colors">
        <span className="text-[10px] text-primary-500 font-medium">{label}</span>
        <span className="text-xs text-gray-700">{value}</span>
        <Pencil size={9} className="text-primary-400 ml-0.5" />
      </button>
    )
  }

  if (!user) {
    navigate('/login', { state: { from: '/requests/post' } })
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (submittingRef.current) return
    submittingRef.current = true

    // Validate the service-time window if provided
    let serviceStartIso: string | null = null
    let serviceEndIso:   string | null = null
    if (startAt) {
      const s = new Date(startAt)
      if (Number.isNaN(s.getTime())) { toast('服务开始时间无效', 'error'); submittingRef.current = false; return }
      serviceStartIso = s.toISOString()
    }
    if (endAt) {
      if (!startAt) { toast('请先填写服务开始时间', 'error'); submittingRef.current = false; return }
      const e2 = new Date(endAt)
      if (Number.isNaN(e2.getTime())) { toast('服务结束时间无效', 'error'); submittingRef.current = false; return }
      if (serviceStartIso && e2.getTime() < new Date(serviceStartIso).getTime()) {
        toast('结束时间不能早于开始时间', 'error'); submittingRef.current = false; return
      }
      serviceEndIso = e2.toISOString()
    }

    setLoading(true)

    // Merge AI-extracted chips into description
    let finalDesc = desc.trim()
    if (extracted) {
      const extras: string[] = []
      if (extracted.location_from) extras.push(`起点：${extracted.location_from}`)
      if (extracted.location_to)   extras.push(`终点：${extracted.location_to}`)
      if (extracted.special_notes) extras.push(extracted.special_notes)
      if (extracted.items)         extras.push(`物品：${extracted.items}`)
      if (extras.length) finalDesc = [finalDesc, ...extras].filter(Boolean).join('；')
    }

    const modResult = await moderateContent({ title, description: finalDesc })
    if (!modResult.pass) {
      toast(`内容审核未通过：${modResult.reason ?? '包含违规内容'}`, 'error')
      setLoading(false)
      submittingRef.current = false
      return
    }
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()

    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        user_id:    user!.id,
        title:      title.trim(),
        description: [customCat.trim() ? `[${customCat.trim()}]` : '', finalDesc].filter(Boolean).join(' ') || null,
        category,
        area:       area || null,
        city:       'Toronto',
        lat:        locCoords?.lat ?? null,
        lng:        locCoords?.lng ?? null,
        budget:     budget.trim() || null,
        service_at_start: serviceStartIso,
        service_at_end:   serviceEndIso,
        expires_at: expiresAt,
        status:     'open',
      })
      .select('*, requester:users(id, name, avatar_url)')
      .single()

    setLoading(false)

    if (error) {
      toast('发布失败，请重试', 'error')
      submittingRef.current = false
      return
    }

    const daysLeft = days
    addServiceRequest({
      id: data.id,
      userId: data.user_id,
      title: data.title,
      description: data.description ?? '',
      category: data.category,
      area: data.area ?? '',
      city: data.city ?? 'Toronto',
      lat: undefined,
      lng: undefined,
      budget: data.budget ?? '',
      serviceAtStart: data.service_at_start ?? undefined,
      serviceAtEnd:   data.service_at_end   ?? undefined,
      expiresAt: data.expires_at,
      status: 'open',
      createdAt: data.created_at,
      requester: {
        id: data.requester?.id ?? user!.id,
        name: data.requester?.name ?? '用户',
        avatar: data.requester?.avatar_url ?? undefined,
      },
      daysLeft,
    })

    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6">
        <CheckCircle size={56} className="text-green-500" />
        <h2 className="text-xl font-bold text-gray-800">发布成功！</h2>
        <p className="text-sm text-gray-500 text-center">
          服务商看到你的需求后可以直接联系你
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold"
          >
            返回首页
          </button>
          <button
            onClick={() => { setDone(false); setTitle(''); setDesc(''); setBudget(''); setArea(''); setShareLocation(false); setLocCoords(null); submittingRef.current = false }}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold"
          >
            再发一条
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="w-full px-4 md:w-[520px] mx-auto py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-gray-500 mb-4 text-sm">
          <ArrowLeft size={16} /> 返回
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-1">发布服务需求</h1>
        <p className="text-sm text-gray-400 mb-6">让附近的服务商主动找到你</p>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Title */}
          <div className="card p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              我需要什么服务？ <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：急需搬家帮手，周末可用"
              maxLength={60}
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{title.length}/60</p>
          </div>

          {/* Category */}
          {(() => {
            const BASIC_IDS = ['moving', 'cleaning', 'ride', 'renovation', 'cashwork', 'food']
            const basicCats = CATEGORIES.filter((c) => BASIC_IDS.includes(c.id))
            const visibleCats = catMode === 'basic' ? basicCats : CATEGORIES
            return (
              <div className="card p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">需求类别</label>

                {catMode === 'custom' ? (
                  <div className="space-y-2">
                    <input
                      value={customCat}
                      onChange={(e) => setCustomCat(e.target.value)}
                      placeholder="例：园艺除雪、宠物寄养、其他…"
                      maxLength={20}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                    <button
                      type="button"
                      onClick={() => { setCatMode('all'); setCustomCat(''); setCategory('other') }}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      ← 返回选择类别
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {visibleCats.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all
                            ${category === cat.id
                              ? `${cat.bgColor} ${cat.color} border-current`
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                        >
                          <span>{cat.emoji}</span>
                          <span>{cat.postLabel}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (catMode === 'basic') setCatMode('all')
                        else { setCatMode('custom'); setCategory('other') }
                      }}
                      className="mt-2.5 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ChevronDown size={13} />
                      {catMode === 'basic' ? '更多类别' : '找不到合适的？自己输入'}
                    </button>
                  </>
                )}
              </div>
            )
          })()}

          {/* Description */}
          <div className="card p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              详细描述 <span className="text-gray-400 font-normal">（可选）</span>
            </label>
            <textarea
              value={desc}
              onChange={(e) => { setDesc(e.target.value); setExtracted(null) }}
              rows={3}
              maxLength={300}
              placeholder="补充说明时间、要求、数量等细节…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting || (title.trim().length + desc.trim().length) < 5}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl
                         bg-primary-50 border border-primary-200 text-primary-600
                         text-xs font-semibold hover:bg-primary-100 transition-colors disabled:opacity-40"
            >
              {extracting
                ? <><span className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" /> AI 解析中…</>
                : <><Sparkles size={13} /> AI 智能解析（自动识别类别/地点/物品）</>
              }
            </button>

            <AnimatePresence>
              {extracted && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-3 space-y-2">
                  <p className="text-[11px] text-gray-400 font-medium">✨ AI 解析结果（可点击修改）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {extracted.location_from && (
                      <EditableChip label="起点" value={extracted.location_from}
                        onChange={v => setExtracted(ex => ex ? { ...ex, location_from: v } : ex)} />
                    )}
                    {extracted.location_to && (
                      <EditableChip label="终点" value={extracted.location_to}
                        onChange={v => setExtracted(ex => ex ? { ...ex, location_to: v } : ex)} />
                    )}
                    {extracted.special_notes && (
                      <EditableChip label="特殊情况" value={extracted.special_notes}
                        onChange={v => setExtracted(ex => ex ? { ...ex, special_notes: v } : ex)} />
                    )}
                    {extracted.items && (
                      <EditableChip label="物品" value={extracted.items}
                        onChange={v => setExtracted(ex => ex ? { ...ex, items: v } : ex)} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Area + Budget row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">所在区域</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                <option value="">选择区域</option>
                {TORONTO_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="card p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                预算 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="面议 / $50/时"
                maxLength={20}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>

          {/* Service-time window */}
          <div className="card p-4">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1">
              <Clock size={14} className="text-primary-500" />
              服务时间 <span className="text-gray-400 font-normal">（可选）</span>
            </label>
            <p className="text-xs text-gray-400 mb-3">告诉商家什么时候到几点 · 让对方一眼看清是否能接</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">开始时间</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  min={minDatetime}
                  onChange={(e) => {
                    const v = e.target.value
                    setStartAt(v)
                    // Auto-bump end to start + 2h if end is empty or now < start
                    if (v && (!endAt || new Date(endAt).getTime() < new Date(v).getTime())) {
                      const s = new Date(v)
                      if (!Number.isNaN(s.getTime())) {
                        s.setHours(s.getHours() + 2)
                        setEndAt(toDatetimeLocal(s))
                      }
                    }
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">结束时间</label>
                <input
                  type="datetime-local"
                  value={endAt}
                  min={startAt || minDatetime}
                  disabled={!startAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Share location */}
          <div className="card p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareLocation}
                onChange={(e) => toggleShareLocation(e.target.checked)}
                className="w-4 h-4 accent-primary-600 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <MapPin size={14} className="text-primary-500" />
                  在地图上显示我的大概位置
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {locCoords
                    ? '已获取模糊位置（误差约 1 km），商家可在地图上主动找到你'
                    : '地图仅显示约 1 km 范围的模糊位置，不会暴露你的精确地址'}
                </p>
              </div>
              {locCoords && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium flex-shrink-0">已定位</span>
              )}
            </label>
            {locError && <p className="text-xs text-red-500 mt-2">{locError}</p>}
          </div>

          {/* Expiry */}
          <div className="card p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">有效期</label>
            <div className="flex gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setDays(opt.days)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all
                    ${days === opt.days
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy notice */}
          <p className="text-center text-[11px] text-gray-400 px-2">
            需求过期或取消后，所有内容将自动从平台删除。地图上仅显示约 1 km 精度的模糊位置，不会透露你的精确地址。
          </p>

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50
                       text-white font-bold rounded-xl text-sm transition-colors"
          >
            {loading ? '发布中…' : '发布需求'}
          </button>
        </motion.form>
      </div>
    </div>
  )
}
