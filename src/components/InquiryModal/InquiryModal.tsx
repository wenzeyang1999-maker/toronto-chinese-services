// ─── InquiryModal ─────────────────────────────────────────────────────────────
// "获取报价" feature: user posts a need, service providers reach out to them.
// Two modes: AI mode (free-text → LLM extraction) and manual mode (form).
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensurePhoneVerified } from '../../lib/requirePhoneVerified'
import { toast } from '../../lib/toast'
import PhoneVerifyBanner from '../PhoneVerifyBanner/PhoneVerifyBanner'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, Sparkles, UserCheck, Clock3, ShieldCheck, Pencil, MapPin, Mic, MicOff, Siren, PhoneCall, Radio, MessageCircle, CheckCircle2 } from 'lucide-react'
import OnlineProvidersPanel from '../OnlineProvidersPanel/OnlineProvidersPanel'
import { supabase } from '../../lib/supabase'
import { offsetLocation } from '../../lib/geo'
import { useAuthStore } from '../../store/authStore'
import LocationInput from '../LocationInput/LocationInput'
import { useAppStore } from '../../store/appStore'
import { CATEGORIES } from '../../data/categories'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// 把 MediaRecorder 录音(webm/mp4/ogg)解码后重编码成单声道 WAV(保持原采样率)。
// 目的：MediaRecorder 生成的 webm 头常缺时长信息，Groq/Whisper 服务端解码时会
// 只读到极少/静音 → 幻觉("字幕志愿者""MING PAO")。WAV 头永远正确，稳定可解。
// 不做重采样：Safari 的 OfflineAudioContext 不支持 16kHz 会抛错，直接按原始采样率
// 编码最跨浏览器（Whisper 会自行重采样）。返回 wav Blob + 音量 RMS。
async function toWavMono(blob: Blob): Promise<{ wav: Blob; rms: number }> {
  const arrayBuf = await blob.arrayBuffer()
  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
  const ctx = new AudioCtx()
  const decoded = await ctx.decodeAudioData(arrayBuf)
  ctx.close()

  const n  = decoded.length
  const ch = decoded.numberOfChannels
  const mono = new Float32Array(n)
  for (let c = 0; c < ch; c++) {
    const d = decoded.getChannelData(c)
    for (let i = 0; i < n; i++) mono[i] += d[i] / ch
  }

  let sum = 0
  for (let i = 0; i < n; i++) sum += mono[i] * mono[i]
  const rms = Math.sqrt(sum / Math.max(1, n))

  return { wav: encodeWav(mono, decoded.sampleRate), rms }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeStr(36, 'data'); view.setUint32(40, samples.length * 2, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([view], { type: 'audio/wav' })
}

interface Props {
  open: boolean
  onClose: () => void
  presetCategoryId?: string   // 从类别页/搜索页/服务详情打开时预选类别，免再选
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

// 「让商家联系我」（普通 / 紧急）提交后的确认屏：商家只能站内私信联系，绝不发放
// 客户联系方式。
function SentToProvidersView({ categoryLabel, isUrgent, onClose, onGoMessages }: {
  categoryLabel: string; isUrgent: boolean; onClose: () => void; onGoMessages: () => void
}) {
  const accent = isUrgent ? 'red' : 'primary'
  return (
    <div className="px-5 py-6 space-y-4">
      <div className="flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isUrgent ? 'bg-red-50' : 'bg-primary-50'}`}>
          {isUrgent
            ? <Siren size={30} className="text-red-500 animate-pulse" />
            : <CheckCircle2 size={30} className="text-primary-600" />}
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">{isUrgent ? '🚨 紧急需求已发出' : '需求已发出'}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          {isUrgent ? '已通知所有正在「上线接单」的 ' : '已发给最匹配的 '}
          <span className="font-semibold text-gray-700">{categoryLabel}</span> 商家
        </p>
      </div>

      <div className={`rounded-2xl px-4 py-3.5 space-y-2.5 border ${isUrgent ? 'bg-red-50 border-red-100' : 'bg-primary-50 border-primary-100'}`}>
        <div className="flex items-start gap-2.5">
          <MessageCircle size={15} className={`flex-shrink-0 mt-0.5 ${isUrgent ? 'text-red-500' : 'text-primary-500'}`} />
          <p className="text-[13px] text-gray-700 leading-relaxed">
            商家会通过<span className="font-semibold">站内消息</span>联系你，请留意「我的消息」。
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={15} className={`flex-shrink-0 mt-0.5 ${isUrgent ? 'text-red-500' : 'text-primary-500'}`} />
          <p className="text-[13px] text-gray-700 leading-relaxed">
            出于安全，你的电话/微信/具体位置<span className="font-semibold">不会自动透露给商家</span>——
            要不要给、给谁，由你在聊天里自己决定。
          </p>
        </div>
      </div>

      <button onClick={onGoMessages}
        className={`w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-3 rounded-xl transition-colors active:scale-95 ${
          isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}>
        <MessageCircle size={15} /> 去「我的消息」
      </button>
      <button onClick={onClose}
        className="w-full py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
        知道了，关闭
      </button>
    </div>
  )
}

export default function InquiryModal({ open, onClose, presetCategoryId }: Props) {
  const navigate          = useNavigate()
  const user              = useAuthStore((s) => s.user)
  const userLocation      = useAppStore((s) => s.userLocation)
  const addServiceRequest = useAppStore((s) => s.addServiceRequest)

  const [aiMode,      setAiMode]      = useState(true)
  const [rawInput,    setRawInput]    = useState('')
  const [showAllCats, setShowAllCats] = useState(false)   // 手动模式「更多类别」
  const [manualLoc,   setManualLoc]   = useState<{ address: string; lat: number; lng: number } | null>(null) // 选填：需求地点≠当前位置时手填
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
  const [isUrgent,    setIsUrgent]    = useState(false)   // 紧急单：发给所有在线商家，每天限 1 次
  const [contactMode, setContactMode] = useState<'providers_contact' | 'self_contact'>('providers_contact')
  const [isListening,  setIsListening]  = useState(false)   // 录音中
  const [transcribing, setTranscribing] = useState(false)   // 上传转写中
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)

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
    supabase.rpc('get_my_contact').returns<{ name: string; phone: string; wechat: string }[]>().maybeSingle()
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
  // 从类别页/搜索页/服务详情打开时：预选类别并直接进入手动表单，用户免选类别。
  useEffect(() => {
    if (open && presetCategoryId) {
      setAiMode(false)
      setForm((f) => ({ ...f, categoryId: presetCategoryId }))
      setErrors((e) => ({ ...e, categoryId: undefined }))
    }
  }, [open, presetCategoryId])

  // 语音输入：录音 → 上传给 transcribe-audio(Groq Whisper) 转写。
  // 取代浏览器 Web Speech API —— 后者在 Safari/iOS 上给了麦克风权限也常无结果。
  const voiceSupported = typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  async function startVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      chunksRef.current = []
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        void transcribe()
      }
      mediaRecorderRef.current = rec
      rec.start()
      setIsListening(true)
    } catch (err: any) {
      setIsListening(false)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        toast('麦克风被拒绝。请在浏览器/系统设置里允许麦克风后重试', 'error')
      } else if (err?.name === 'NotFoundError') {
        toast('未检测到麦克风设备，请检查后重试', 'error')
      } else {
        toast('无法开始录音，请重试或改用手动填写', 'error')
      }
    }
  }

  function stopVoice() {
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()   // 触发 onstop → transcribe()
    setIsListening(false)
  }

  async function transcribe() {
    const type = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const raw  = new Blob(chunksRef.current, { type })
    chunksRef.current = []
    if (raw.size === 0) return
    setTranscribing(true)
    try {
      // 转成 16k 单声道 WAV（规避 webm 头缺时长导致 Whisper 读成静音）。
      let file: Blob = raw
      let filename = `voice.${type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'}`
      try {
        const { wav, rms } = await toWavMono(raw)
        if (rms < 0.003) {   // 基本静音 → 采集问题，别浪费一次转写
          toast('没检测到声音，请确认麦克风选对、音量足够后再试', 'error')
          return
        }
        file = wav
        filename = 'voice.wav'
      } catch { /* 解码失败则退回原始音频直接上传 */ }

      const fd = new FormData()
      fd.append('file', file, filename)
      fd.append('language', 'auto')   // 自动识别：支持普通话 / 英语 / 中英混说
      // 直接 fetch 上传 multipart（不手动设 Content-Type，让浏览器带上 boundary）；
      // 比 functions.invoke 更可靠地传输二进制音频。
      const res = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data as { error?: string } | null)?.error || 'fail')
      const text = (data as { text?: string } | null)?.text?.trim()
      if (!text) {
        // Whisper 没听清或识别为幻觉落款，已被后端清空 → 提示重说，不填入垃圾。
        toast('没听清，请靠近麦克风、稍慢些再说一次', 'info')
        return
      }
      setRawInput(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))
      setExtracted(null)
    } catch (_e) {
      toast('语音识别失败，请重试或手动填写', 'error')
    } finally {
      setTranscribing(false)
    }
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

  // 手动模式的「AI 智能解析」：对已填的详细描述做自动识别，回填类别/时间，并把
  // 识别到的地点/物品补进描述（保留 AI 自动拾取能力，与图3 一致）。
  async function handleExtractManual() {
    const text = form.description.trim()
    if (!text) { setErrors(e => ({ ...e, description: '请先填写需求描述' })); return }
    setExtracting(true)
    try {
      const { data, error } = await supabase.functions.invoke('extract-inquiry', { body: { text } })
      if (error || data?.error) throw new Error(data?.error || 'extract failed')
      const ext = data as Extracted
      const matchedCat = CATEGORIES.find(c => c.id === ext.category)
      const validTiming = ['asap', 'flexible', 'next_week'].includes(ext.timing ?? '')
        ? (ext.timing as InquiryForm['timing']) : form.timing
      const extras = [
        ext.location_from ? `起：${ext.location_from}` : '',
        ext.location_to ? `到：${ext.location_to}` : '',
        ext.special_notes || '',
        ext.items ? `物品：${ext.items}` : '',
      ].filter(Boolean).join('，')
      setForm(f => ({
        ...f,
        categoryId: matchedCat ? ext.category! : f.categoryId,
        timing: validTiming,
        description: extras && !f.description.includes(extras) ? `${f.description}（AI识别：${extras}）` : f.description,
      }))
      setErrors(e => ({ ...e, categoryId: undefined }))
    } catch {
      setErrors(e => ({ ...e, description: '解析失败，请手动选择类别' }))
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

      // B7 隐私：inquiries.lat/lng 存「模糊」坐标（抢单期粗略距离/匹配用，全体抢单
      // 师傅可读）；精确坐标进 precise_lat/lng，仅 owner/录用师傅可经 RPC 取。
      // 需求地点：优先用手动填的地点（选填），否则用当前 GPS 定位。
      const effLoc = manualLoc ?? userLocation
      const blurLoc = effLoc ? offsetLocation(effLoc.lat, effLoc.lng) : null
      // 「让商家联系我」必建公开需求帖：它是商家唯一的联系入口——商家在帖里点
      // 「联系发布者」发起站内会话（帖子无 PII、只有模糊坐标）。紧急时该帖 is_urgent
      // 触发在线商家实时弹窗。「主动联系」是拉模式，公开帖按用户勾选可选。
      const broadcastUrgent = isUrgent && contactMode === 'providers_contact'
      const doPublic = postPublic || contactMode === 'providers_contact'

      // 「我主动联系」且不发公开帖：只是浏览在线商家、不派单、不发帖，
      // 因此完全不写 inquiries/service_requests → 不占用会员「最多 N 条需求」配额
      //（配额触发器挂在 inquiries 表上）。仅当 doPublic 时才落库。
      let insertedInquiryId: string | null = null
      if (doPublic) {
      // 门槛：受限账号（≥5 有效投诉或严重仲裁判负）限制发单
      const { data: canPost } = await supabase.rpc('can_participate', { p_user: user.id })
      if (canPost === false) {
        setServerError('您的账号因多次有效投诉被限制发单，请先处理纠纷或联系客服')
        setSubmitting(false)
        return
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
        lat:         blurLoc?.lat ?? null,
        lng:         blurLoc?.lng ?? null,
        precise_lat: effLoc?.lat ?? null,
        precise_lng: effLoc?.lng ?? null,
        status:      'open',
        is_urgent:   isUrgent,
        contact_mode: contactMode,
      }).select('id').single()
      if (error) throw error
      insertedInquiryId = inserted.id

      {
        // Direct-dispatch means matched merchants reach out right away, so the
        // public post only needs a short life. Keep it fresh: 3 days.
        const expiryDays = 3
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
        // Privacy: the public demand pin must NOT sit on the real address —
        // shift it a random 300–900 m before storing (same as PostRequest).
        const pubLoc = effLoc ? offsetLocation(effLoc.lat, effLoc.lng) : null
        const { data: reqData } = await supabase
          .from('service_requests')
          .insert({
            user_id:     user.id,
            inquiry_id:  inserted.id,
            title,
            description: publicDesc,
            category:    form.categoryId || 'other',
            city:        'Toronto',
            area:        manualLoc?.address ?? null,
            budget:      form.budget.trim() || null,
            lat:         pubLoc?.lat ?? null,
            lng:         pubLoc?.lng ?? null,
            expires_at:  expiresAt,
            status:      'open',
            is_urgent:   broadcastUrgent,
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
            isUrgent: broadcastUrgent,
            requester: {
              id: reqData.requester?.id ?? user.id,
              name: reqData.requester?.name ?? form.name,
              avatar: reqData.requester?.avatar_url ?? undefined,
            },
            daysLeft: expiryDays,
          })
        }
      }

      // 「让商家联系你」→ 派单给商家（普通=top5，紧急=所有在线）。
      // 「主动联系上线商家」→ 拉模式，不派单，客户直接看在线商家名片墙。
      if (contactMode === 'providers_contact') {
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
            isUrgent,
          },
        })
      }
      } // end if (doPublic) —— 「我主动联系」且不发帖时以上落库/派单全部跳过

      setInsertedId(insertedInquiryId)
      setDone(true)
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? ''
      // Daily urgent cap / member quota triggers raise a friendly Chinese message.
      setServerError(/紧急|每人每天|上限|额度/.test(msg) ? msg : '提交失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    stopVoice()
    onClose()
    setTimeout(() => {
      setForm(INITIAL); setErrors({}); setDone(false); setServerError('')
      setRawInput(''); setExtracted(null); setExtractError(''); setAiMode(true); setPostPublic(true); setManualLoc(null); setShowAllCats(false)
      setIsUrgent(false); setContactMode('providers_contact')
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
              {done ? (
                contactMode === 'self_contact' ? (
                  <OnlineProvidersPanel
                    categoryId={form.categoryId}
                    categoryLabel={(() => {
                      const cat = CATEGORIES.find(c => c.id === form.categoryId)
                      return cat ? `${cat.emoji} ${cat.label}` : form.categoryId
                    })()}
                    customerLoc={manualLoc ?? userLocation}
                    onClose={handleClose}
                  />
                ) : (
                  <SentToProvidersView
                    categoryLabel={(() => {
                      const cat = CATEGORIES.find(c => c.id === form.categoryId)
                      return cat ? `${cat.emoji} ${cat.label}` : form.categoryId
                    })()}
                    isUrgent={isUrgent}
                    onClose={handleClose}
                    onGoMessages={() => { handleClose(); navigate('/profile?section=messages') }}
                  />
                )
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
                              {transcribing ? '识别中…' : isListening ? '🔴 录音中，点下方按钮停止' : '可用下方语音按钮输入'}
                            </span>
                          )}
                        </label>
                        <textarea
                          rows={4}
                          value={rawInput}
                          onChange={e => { setRawInput(e.target.value); setExtracted(null) }}
                          placeholder={isListening ? '🔴 录音中，点「停止」后自动转成文字…' : transcribing ? '识别中…' : '例：明天下午从North York搬到Markham，三楼无电梯，5个大箱子加一张床'}
                          className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-800
                                     outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                                     resize-none placeholder:text-gray-400 transition-colors
                                     ${isListening ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}
                        />
                      </div>

                      {/* 语音输入 —— 做成和「AI 智能解析」同款的大按钮 */}
                      {voiceSupported && (
                        <button
                          type="button"
                          disabled={transcribing}
                          onClick={isListening ? stopVoice : startVoice}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-70
                            ${isListening
                              ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse'
                              : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'}`}
                        >
                          {transcribing
                            ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full" /> 识别中…</>
                            : isListening
                              ? <><MicOff size={18} /> 正在聆听…点击停止</>
                              : <><Mic size={18} /> 点击语音输入</>}
                        </button>
                      )}

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
                      {/* 需求类别 — 芯片平铺（图3） */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          需求类别 <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(showAllCats ? CATEGORIES : CATEGORIES.slice(0, 6)).map(c => (
                            <button key={c.id} type="button" onClick={() => update('categoryId', c.id)}
                              className={`flex items-center justify-center gap-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                form.categoryId === c.id
                                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}>
                              <span>{c.emoji}</span> {c.label}
                            </button>
                          ))}
                        </div>
                        {CATEGORIES.length > 6 && (
                          <button type="button" onClick={() => setShowAllCats(v => !v)}
                            className="mt-2 text-xs text-gray-400 flex items-center gap-0.5 hover:text-gray-600">
                            <ChevronDown size={13} className={showAllCats ? 'rotate-180 transition-transform' : 'transition-transform'} />
                            {showAllCats ? '收起' : '更多类别'}
                          </button>
                        )}
                        {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>}
                      </div>

                      {/* 详细描述 + AI 智能解析（保留 AI 自动拾取） */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          详细描述 <span className="text-gray-400 font-normal text-xs">（可选，可 AI 自动识别）</span>
                        </label>
                        <textarea
                          rows={3}
                          value={form.description}
                          onChange={e => update('description', e.target.value)}
                          placeholder="补充说明时间、地点、物品、要求等细节…"
                          maxLength={300}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
                                     outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
                        />
                        <p className="text-xs text-gray-400 text-right mt-0.5">{form.description.length}/300</p>
                        {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}
                        <button type="button" onClick={handleExtractManual}
                          disabled={extracting || !form.description.trim()}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-primary-200
                                     bg-primary-50 text-primary-600 text-sm font-semibold hover:bg-primary-100 disabled:opacity-50 transition-colors">
                          {extracting
                            ? <><span className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" /> 识别中…</>
                            : <><Sparkles size={15} /> AI 智能解析（自动识别类别/地点/物品）</>}
                        </button>
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

                      {/* 需求地点（选填）— 不填默认用当前定位；地点≠当前位置时可手填 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          需求地点 <span className="text-gray-400 font-normal text-xs">（选填，不填默认用当前定位）</span>
                        </label>
                        <LocationInput onChange={setManualLoc} />
                        {manualLoc && (
                          <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                            <MapPin size={11} /> 已定位：{manualLoc.address}
                          </p>
                        )}
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

                      {/* 联系方式：让商家联系你 / 主动联系上线商家 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">你希望怎么联系</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setContactMode('providers_contact')}
                            className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 text-center transition-all ${
                              contactMode === 'providers_contact' ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-gray-50'
                            }`}>
                            <PhoneCall size={17} className={contactMode === 'providers_contact' ? 'text-primary-600' : 'text-gray-400'} />
                            <span className="text-xs font-semibold text-gray-800">让商家联系我</span>
                            <span className="text-[10px] text-gray-400 leading-tight px-1">派单给商家，等 TA 联系</span>
                          </button>
                          <button type="button" onClick={() => setContactMode('self_contact')}
                            className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 text-center transition-all ${
                              contactMode === 'self_contact' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-gray-50'
                            }`}>
                            <Radio size={17} className={contactMode === 'self_contact' ? 'text-emerald-600' : 'text-gray-400'} />
                            <span className="text-xs font-semibold text-gray-800">我主动联系</span>
                            <span className="text-[10px] text-gray-400 leading-tight px-1">看在线商家，自己联系</span>
                          </button>
                        </div>
                      </div>

                      {/* 紧急需求开关 */}
                      <label className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer transition-all ${
                        isUrgent ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'
                      }`}>
                        <input
                          type="checkbox"
                          checked={isUrgent}
                          onChange={e => setIsUrgent(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-red-600 flex-shrink-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                            <Siren size={14} className={`flex-shrink-0 ${isUrgent ? 'text-red-500' : 'text-gray-400'}`} />
                            紧急需求
                            <span className="text-[10px] font-normal text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full">每天限 1 次</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                            {contactMode === 'self_contact'
                              ? '优先只显示正在「上线接单」的商家，方便你立刻联系'
                              : '立即通知所有正在「上线接单」的匹配商家（含手机弹窗提醒），催单更快'}
                          </p>
                        </div>
                      </label>

                      {/* 公开需求帖：让商家联系我时必发（是商家私信你的入口），只在
                          主动联系模式下作为可选项。 */}
                      {contactMode === 'self_contact' ? (
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
                              让附近更多商家在地图上看到你的需求，主动私信你，增加收到回复的机会
                            </p>
                          </div>
                        </label>
                      ) : (
                        <div className="flex items-start gap-2.5 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
                          <ShieldCheck size={14} className="text-primary-500 flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] text-gray-500 leading-relaxed">
                            商家只会通过<span className="font-semibold text-gray-700">站内私信</span>联系你，
                            <span className="font-semibold text-gray-700">看不到你的电话/微信</span>；
                            要不要给，由你在聊天里自己决定。
                          </p>
                        </div>
                      )}

                      {serverError && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3">
                          {serverError}
                        </div>
                      )}

                      <motion.button
                        type="submit"
                        disabled={submitting}
                        whileTap={{ scale: submitting ? 1 : 0.97 }}
                        className={`w-full py-3.5 text-sm rounded-2xl disabled:opacity-60 font-semibold text-white transition-colors ${
                          isUrgent ? 'bg-red-600 hover:bg-red-700' : 'btn-primary'
                        }`}
                      >
                        {submitting
                          ? '提交中...'
                          : isUrgent
                            ? '🚨 紧急发布'
                            : contactMode === 'self_contact'
                              ? '查找在线商家'
                              : '免费获取报价'}
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
