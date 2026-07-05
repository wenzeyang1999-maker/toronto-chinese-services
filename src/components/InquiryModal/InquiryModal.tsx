// ─── InquiryModal ─────────────────────────────────────────────────────────────
// "获取报价" feature: user posts a need, service providers reach out to them.
// Two modes: AI mode (free-text → LLM extraction) and manual mode (form).
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensurePhoneVerified } from '../../lib/requirePhoneVerified'
import PhoneVerifyBanner from '../PhoneVerifyBanner/PhoneVerifyBanner'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, Sparkles, UserCheck, Clock3, ShieldCheck, Pencil, MapPin, Mic, MicOff } from 'lucide-react'
import InquiryResultPanel from '../InquiryResultPanel/InquiryResultPanel'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { CATEGORIES } from '../../data/categories'

interface Props {
  open: boolean
  onClose: () => void
}

interface InquiryForm {
  categoryId: string
  description: string
  budget: string
  timing: 'asap' | 'flexible' | 'next_week'
  name: string
  phone: string
  wechat: string
}

interface Extracted {
  category:      string | null
  timing:        string | null
  location_from: string | null
  location_to:   string | null
  special_notes: string | null
  items:         string | null
  description:   string | null
}

const INITIAL: InquiryForm = {
  categoryId: '',
  description: '',
  budget: '',
  timing: 'flexible',
  name: '',
  phone: '',
  wechat: '',
}

const TIMING_OPTIONS = [
  { value: 'asap',      label: '尽快' },
  { value: 'flexible',  label: '时间灵活' },
  { value: 'next_week', label: '下周内' },
] as const

export default function InquiryModal({ open, onClose }: Props) {
  const navigate          = useNavigate()
  const user              = useAuthStore((s) => s.user)
  const userLocation      = useAppStore((s) => s.userLocation)
  const addServiceRequest = useAppStore((s) => s.addServiceRequest)

  const [aiMode,      setAiMode]      = useState(true)
  const [rawInput,    setRawInput]    = useState('')
  const [extracting,  setExtracting]  = useState(false)
  const [extracted,   setExtracted]   = useState<Extracted | null>(null)
  const [extractError, setExtractError] = useState('')

  const [form,        setForm]        = useState<InquiryForm>(INITIAL)
  const [errors,      setErrors]      = useState<Partial<Record<keyof InquiryForm, string>>>({})
  const [submitting,  setSubmitting]  = useState(false)
  const [done,        setDone]        = useState(false)
  const [insertedId,  setInsertedId]  = useState<string | null>(null)
  const [serverError, setServerError] = useState('')
  const [postPublic,  setPostPublic]  = useState(true)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Auto-fill contact from the logged-in user's saved profile (name / phone /
  // wechat) when the modal opens — fills empty fields only, never overwrites what
  // the user or the AI parse already put in.
  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    const meta = (user.user_metadata ?? {}) as { name?: string; phone?: string }
    // Auth-object fallbacks (registration metadata / Supabase auth phone) fill in
    // even before the users-table row is fetched.
    setForm((f) => ({
      ...f,
      name:  f.name.trim()  ? f.name  : (meta.name ?? ''),
      phone: f.phone.trim() ? f.phone : (meta.phone ?? user.phone ?? ''),
    }))
    supabase.from('users').select('name, phone, wechat').eq('id', user.id).single()
      .then(({ data }) => {
        if (cancelled || !data) return
        setForm((f) => ({
          ...f,
          name:   f.name.trim()   ? f.name   : (data.name   ?? meta.name  ?? ''),
          phone:  f.phone.trim()  ? f.phone  : (data.phone  ?? meta.phone ?? user.phone ?? ''),
          wechat: f.wechat.trim() ? f.wechat : (data.wechat ?? ''),
        }))
      })
    return () => { cancelled = true }
  }, [open, user])
  const voiceSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'zh-CN'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript)
        .join('')
      setRawInput(transcript)
      setExtracted(null)
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  const update = <K extends keyof InquiryForm>(field: K, value: InquiryForm[K]) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  // ── AI extraction ────────────────────────────────────────────────────────────
  async function handleExtract() {
    if (!rawInput.trim()) { setExtractError('请先输入需求描述'); return }
    setExtracting(true)
    setExtractError('')
    setExtracted(null)
    try {
      const { data, error } = await supabase.functions.invoke('extract-inquiry', {
        body: { text: rawInput.trim() },
      })
      if (error) throw error
      if (data.error) throw new Error(data.error)
      const ext = data as Extracted
      setExtracted(ext)
      // Pre-fill form fields from extraction
      const validTiming = ['asap', 'flexible', 'next_week'].includes(ext.timing ?? '')
        ? (ext.timing as InquiryForm['timing'])
        : 'flexible'
      const matchedCat = CATEGORIES.find(c => c.id === ext.category)
      setForm(f => ({
        ...f,
        categoryId:  matchedCat ? ext.category! : '',
        timing:      validTiming,
        description: ext.description ?? rawInput.trim(),
      }))
    } catch (e) {
      setExtractError('解析失败，请重试或切换手动模式')
      console.error(e)
    } finally {
      setExtracting(false)
    }
  }

  // ── Validation & submit ──────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Partial<Record<keyof InquiryForm, string>> = {}
    if (!form.categoryId)          errs.categoryId  = '请选择服务类型'
    if (!form.description.trim())  errs.description = '请描述您的需求'
    if (!form.name.trim())         errs.name        = '请填写姓名'
    if (!form.phone.trim()) {
      errs.phone = '请填写联系电话'
    } else if (!/^[\d\s\-+().]{7,20}$/.test(form.phone.trim())) {
      errs.phone = '请输入有效的电话号码'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (!user) {
      onClose()
      navigate('/login', { state: { from: '/' } })
      return
    }
    if (!(await ensurePhoneVerified(navigate))) { onClose(); return }

    setSubmitting(true)
    setServerError('')
    try {
      // Build description: if AI mode, merge extracted chips into description
      let finalDescription = form.description.trim()
      if (aiMode && extracted) {
        const parts = [finalDescription]
        if (extracted.location_from) parts.push(`起点：${extracted.location_from}`)
        if (extracted.location_to)   parts.push(`终点：${extracted.location_to}`)
        if (extracted.special_notes) parts.push(extracted.special_notes)
        if (extracted.items)         parts.push(`物品：${extracted.items}`)
        finalDescription = parts.join('；')
      }

      const { data: inserted, error } = await supabase.from('inquiries').insert({
        category_id: form.categoryId,
        description: finalDescription,
        budget:      form.budget.trim() || null,
        timing:      form.timing,
        name:        form.name.trim(),
        phone:       form.phone.trim(),
        wechat:      form.wechat.trim() || null,
        user_id:     user.id,
        lat:         userLocation?.lat ?? null,
        lng:         userLocation?.lng ?? null,
        status:      'open',
      }).select('id').single()
      if (error) throw error

      if (user?.id && postPublic) {
        const expiryDays = form.timing === 'asap' ? 7 : form.timing === 'next_week' ? 14 : 30
        const expiresAt  = new Date(Date.now() + expiryDays * 86_400_000).toISOString()
        const cat        = CATEGORIES.find((c) => c.id === form.categoryId)
        const rawText    = (aiMode ? rawInput : form.description).trim()
        const title      = rawText.length > 0
          ? rawText.slice(0, 40) + (rawText.length > 40 ? '…' : '')
          : `${form.timing === 'asap' ? '急需' : '需要'}${cat ? ` ${cat.label}` : ''}服务`
        const TIMING_LABEL: Record<string, string> = {
          asap:      '急需，尽快安排',
          next_week: '下周内',
          flexible:  '时间灵活',
        }
        const timingTag = `【${TIMING_LABEL[form.timing] ?? form.timing}】`
        const publicDesc = finalDescription
          ? `${timingTag} ${finalDescription}`
          : timingTag
        const { data: reqData } = await supabase
          .from('service_requests')
          .insert({
            user_id:     user.id,
            title,
            description: publicDesc,
            category:    form.categoryId || 'other',
            city:        'Toronto',
            budget:      form.budget.trim() || null,
            lat:         userLocation?.lat ?? null,
            lng:         userLocation?.lng ?? null,
            expires_at:  expiresAt,
            status:      'open',
          })
          .select('*, requester:users(id, name, avatar_url)')
          .single()
        if (reqData) {
          addServiceRequest({
            id: reqData.id,
            userId: reqData.user_id,
            title: reqData.title,
            description: reqData.description ?? '',
            category: reqData.category,
            area: reqData.area ?? '',
            city: reqData.city ?? 'Toronto',
            lat: reqData.lat ?? undefined,
            lng: reqData.lng ?? undefined,
            budget: reqData.budget ?? '',
            expiresAt: reqData.expires_at,
            status: 'open',
            createdAt: reqData.created_at,
            requester: {
              id: reqData.requester?.id ?? user.id,
              name: reqData.requester?.name ?? form.name,
              avatar: reqData.requester?.avatar_url ?? undefined,
            },
            daysLeft: expiryDays,
          })
        }
      }

      const cat = CATEGORIES.find((c) => c.id === form.categoryId)
      void supabase.functions.invoke('match-inquiry-providers', {
        body: {
          inquiryId:     inserted.id,
          categoryId:    form.categoryId,
          categoryLabel: cat ? `${cat.emoji} ${cat.label}` : form.categoryId,
          description:   finalDescription,
          budget:        form.budget.trim(),
          timing:        form.timing,
          name:          form.name.trim(),
          phone:         form.phone.trim(),
          wechat:        form.wechat.trim(),
        },
      })

      setInsertedId(inserted.id)
      setDone(true)
    } catch {
      setServerError('提交失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    stopVoice()
    onClose()
    setTimeout(() => {
      setForm(INITIAL); setErrors({}); setDone(false); setServerError('')
      setRawInput(''); setExtracted(null); setExtractError(''); setAiMode(true); setPostPublic(true)
      setInsertedId(null)
    }, 350)
  }

  // ── Chip helper ──────────────────────────────────────────────────────────────
  function EditableChip({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const [editing, setEditing] = useState(false)
    if (editing) {
      return (
        <div className="flex items-center gap-1 bg-primary-50 border border-primary-300 rounded-xl px-2 py-1">
          <span className="text-[10px] text-primary-500 font-medium whitespace-nowrap">{label}</span>
          <input
            autoFocus
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => e.key === 'Enter' && setEditing(false)}
            className="text-xs text-gray-800 bg-transparent outline-none w-24 border-b border-primary-300"
          />
        </div>
      )
    }
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 bg-primary-50 border border-primary-200 rounded-xl px-2.5 py-1 hover:border-primary-400 transition-colors"
      >
        <span className="text-[10px] text-primary-500 font-medium">{label}</span>
        <span className="text-xs text-gray-700">{value}</span>
        <Pencil size={9} className="text-primary-400 ml-0.5" />
      </button>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 z-[60]"
          />

          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-3xl shadow-2xl
                       md:inset-0 md:m-auto md:rounded-3xl md:max-w-lg md:max-h-[90vh] md:overflow-hidden"
            style={{ maxHeight: '92vh' }}
          >
            {/* Handle bar */}
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">免费获取报价</h2>
                <p className="text-xs text-gray-400 mt-0.5">填写需求，服务商主动联系您</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Mode toggle */}
                <div className="flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setAiMode(true)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      aiMode ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'
                    }`}
                  >
                    <Sparkles size={11} /> AI 语音
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiMode(false)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      !aiMode ? 'bg-white shadow-sm text-gray-700' : 'text-gray-500'
                    }`}
                  >
                    手动填写
                  </button>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 130px)' }}>
              {done && insertedId ? (
                <InquiryResultPanel
                  inquiryId={insertedId}
                  categoryId={form.categoryId}
                  categoryLabel={(() => {
                    const cat = CATEGORIES.find(c => c.id === form.categoryId)
                    return cat ? `${cat.emoji} ${cat.label}` : form.categoryId
                  })()}
                  customerName={form.name}
                  customerPhone={form.phone}
                  customerWechat={form.wechat}
                  onClose={handleClose}
                />
              ) : (
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 pb-8">
                  <PhoneVerifyBanner />

                  {aiMode ? (
                    /* ── AI MODE ─────────────────────────────────────────── */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          描述您的需求
                          {voiceSupported && (
                            <span className="ml-2 text-[11px] font-normal text-gray-400">
                              {isListening ? '🔴 正在聆听，点麦克风停止' : '可点麦克风语音输入'}
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <textarea
                            rows={4}
                            value={rawInput}
                            onChange={e => { setRawInput(e.target.value); setExtracted(null) }}
                            placeholder={isListening ? '说话中，识别结果会自动显示…' : '例：明天下午从North York搬到Markham，三楼无电梯，5个大箱子加一张床'}
                            className={`w-full border rounded-xl px-4 py-3 pr-12 text-sm text-gray-800
                                       outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                                       resize-none placeholder:text-gray-400 transition-colors
                                       ${isListening ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}
                          />
                          {voiceSupported && (
                            <button
                              type="button"
                              onClick={isListening ? stopVoice : startVoice}
                              className={`absolute bottom-3 right-3 p-2 rounded-full transition-all
                                ${isListening
                                  ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse'
                                  : 'bg-gray-100 text-gray-500 hover:bg-primary-50 hover:text-primary-600'}`}
                              title={isListening ? '点击停止录音' : '点击语音输入'}
                            >
                              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleExtract}
                        disabled={extracting || !rawInput.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                                   bg-primary-600 text-white text-sm font-semibold
                                   hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        {extracting
                          ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> AI 解析中...</>
                          : <><Sparkles size={15} /> AI 智能解析</>
                        }
                      </button>

                      {extractError && (
                        <p className="text-xs text-red-500 text-center">{extractError}</p>
                      )}

                      {/* Extracted chips */}
                      {extracted && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3"
                        >
                          <p className="text-xs text-gray-500 font-medium">✨ AI 解析结果（可点击修改）</p>
                          <div className="flex flex-wrap gap-2">
                            {extracted.location_from && (
                              <EditableChip
                                label="起点"
                                value={extracted.location_from}
                                onChange={v => setExtracted(ex => ex ? { ...ex, location_from: v } : ex)}
                              />
                            )}
                            {extracted.location_to && (
                              <EditableChip
                                label="终点"
                                value={extracted.location_to}
                                onChange={v => setExtracted(ex => ex ? { ...ex, location_to: v } : ex)}
                              />
                            )}
                            {extracted.special_notes && (
                              <EditableChip
                                label="特殊情况"
                                value={extracted.special_notes}
                                onChange={v => setExtracted(ex => ex ? { ...ex, special_notes: v } : ex)}
                              />
                            )}
                            {extracted.items && (
                              <EditableChip
                                label="物品"
                                value={extracted.items}
                                onChange={v => setExtracted(ex => ex ? { ...ex, items: v } : ex)}
                              />
                            )}
                          </div>

                          {/* Category from extraction */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">服务类型</label>
                            <div className="relative">
                              <select
                                value={form.categoryId}
                                onChange={e => update('categoryId', e.target.value)}
                                className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-2 text-sm
                                           text-gray-800 bg-white outline-none focus:ring-2 focus:ring-primary-400 pr-9"
                              >
                                <option value="">请选择...</option>
                                {CATEGORIES.filter(c => c.id !== 'other').map(c => (
                                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                                ))}
                                <option value="other">其他服务</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                            {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>}
                          </div>

                          {/* Timing */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">时间</label>
                            <div className="flex gap-2">
                              {TIMING_OPTIONS.map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => update('timing', opt.value)}
                                  className={`flex-1 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                                    form.timing === opt.value
                                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    /* ── MANUAL MODE ─────────────────────────────────────── */
                    <div className="space-y-4">
                      {/* Category */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          服务类型 <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={form.categoryId}
                            onChange={e => update('categoryId', e.target.value)}
                            className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                                       text-gray-800 bg-white outline-none focus:ring-2 focus:ring-primary-400
                                       focus:border-transparent pr-9"
                          >
                            <option value="">请选择服务类型...</option>
                            {CATEGORIES.filter(c => c.id !== 'other').map(c => (
                              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                            ))}
                            <option value="other">其他服务</option>
                          </select>
                          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                        {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>}
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          需求描述 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={form.description}
                          onChange={e => update('description', e.target.value)}
                          placeholder="请描述您的需求，例如：需要搬两居室，3楼无电梯，下周末可以..."
                          maxLength={300}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
                                     outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
                        />
                        <p className="text-xs text-gray-400 text-right mt-0.5">{form.description.length}/300</p>
                        {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}
                      </div>

                      {/* Budget */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          预算范围 <span className="text-gray-400 font-normal text-xs">（可选）</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="text"
                            value={form.budget}
                            onChange={e => update('budget', e.target.value)}
                            placeholder="例：100–200"
                            className="w-full border border-gray-200 rounded-xl pl-7 pr-4 py-2.5 text-sm
                                       text-gray-800 outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Timing */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">希望服务时间</label>
                        <div className="flex gap-2">
                          {TIMING_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => update('timing', opt.value)}
                              className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-all ${
                                form.timing === opt.value
                                  ? 'border-primary-500 bg-primary-50 text-primary-600'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Contact info (both modes) ───────────────────────── */}
                  {(!aiMode || extracted) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-xs text-gray-400">联系方式</span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>

                      {/* Budget (AI mode) */}
                      {aiMode && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            预算范围 <span className="text-gray-400 font-normal">（可选）</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="text"
                              value={form.budget}
                              onChange={e => update('budget', e.target.value)}
                              placeholder="例：100–200"
                              className="w-full border border-gray-200 rounded-xl pl-7 pr-4 py-2 text-sm
                                         text-gray-800 outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          姓名 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          autoComplete="name"
                          value={form.name}
                          onChange={e => update('name', e.target.value)}
                          placeholder="您的称呼"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                                     text-gray-800 outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          电话 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          autoComplete="tel"
                          value={form.phone}
                          onChange={e => update('phone', e.target.value)}
                          placeholder="647-xxx-xxxx"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                                     text-gray-800 outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        />
                        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          微信号 <span className="text-gray-400 font-normal text-xs">（可选）</span>
                        </label>
                        <input
                          type="text"
                          value={form.wechat}
                          onChange={e => update('wechat', e.target.value)}
                          placeholder="您的微信号"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                                     text-gray-800 outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        />
                      </div>

                      {/* Public post toggle */}
                      <label className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer transition-all ${
                        postPublic ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-gray-50'
                      }`}>
                        <input
                          type="checkbox"
                          checked={postPublic}
                          onChange={e => setPostPublic(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-primary-600 flex-shrink-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                            <MapPin size={13} className="text-primary-500 flex-shrink-0" />
                            同时发布公开需求帖
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                            让附近更多商家在地图上看到你的需求，主动联系你报价，增加收到回复的机会
                          </p>
                        </div>
                      </label>

                      {serverError && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3">
                          {serverError}
                        </div>
                      )}

                      <motion.button
                        type="submit"
                        disabled={submitting}
                        whileTap={{ scale: submitting ? 1 : 0.97 }}
                        className="w-full btn-primary py-3.5 text-sm rounded-2xl disabled:opacity-60"
                      >
                        {submitting ? '提交中...' : '免费获取报价'}
                      </motion.button>
                    </motion.div>
                  )}

                  {/* How it works */}
                  {!extracted && !aiMode && (
                    <div className="rounded-2xl bg-primary-50 border border-primary-100 px-4 py-4 space-y-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Sparkles size={13} className="text-primary-500" />
                        <span className="text-xs font-semibold text-primary-700 tracking-wide">AI 智能匹配流程</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Sparkles size={11} className="text-primary-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">AI 自动匹配附近服务商</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">系统将根据您的需求与所在区域，自动筛选评分高、距离近的服务商</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <UserCheck size={11} className="text-primary-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">服务商主动联系您</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">匹配到的服务商将通过电话或微信与您取得联系，提供报价及方案</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Clock3 size={11} className="text-primary-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">通常 24 小时内收到回复</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">高峰时段可能略有延迟，您可同时收到多家报价，自由比较选择</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-primary-100">
                        <ShieldCheck size={12} className="text-primary-400 flex-shrink-0" />
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          您的联系方式仅用于服务商回复，不会公开展示或转让给第三方
                        </p>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
