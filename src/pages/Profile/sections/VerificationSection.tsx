// ─── Verification Section ─────────────────────────────────────────────────────
// • 身份验证 : email status + phone OTP (needs Supabase Phone Provider + Twilio)
// • 联系方式 : wechat / whatsapp / xiaohongshu / facebook / instagram / line /
//             telegram / website  — stored in users.social_links JSONB
// • 商户资质 : upload docs to avatars/{uid}/verify-doc.*
import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Phone, ShieldCheck, Upload, FileCheck,
  AlertCircle, CheckCircle2, Send, RefreshCw, Pencil, Check, X,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Props { user: SupabaseUser }

// ── Social platform definitions ───────────────────────────────────────────────
type SocialKey = 'wechat' | 'whatsapp' | 'xiaohongshu' | 'facebook' | 'instagram' | 'line' | 'telegram' | 'website'

interface Platform {
  key:         SocialKey
  label:       string
  placeholder: string
  color:       string   // Tailwind bg color class
  icon:        string   // emoji stand-in (no brand icons in lucide)
  hint?:       string
}

const PLATFORMS: Platform[] = [
  { key: 'wechat',      label: '微信',      icon: '💬', color: 'bg-green-500',   placeholder: '微信号',                   hint: '服务详情页显示，方便客户联系' },
  { key: 'whatsapp',    label: 'WhatsApp',  icon: '📲', color: 'bg-emerald-500', placeholder: '+1 647 123 4567',          hint: '含国家代码' },
  { key: 'xiaohongshu', label: '小红书',    icon: '📕', color: 'bg-rose-500',    placeholder: '小红书号或主页链接' },
  { key: 'instagram',   label: 'Instagram', icon: '📷', color: 'bg-pink-500',    placeholder: '@用户名' },
  { key: 'facebook',    label: 'Facebook',  icon: '👥', color: 'bg-blue-600',    placeholder: 'facebook.com/你的主页' },
  { key: 'line',        label: 'Line',      icon: '🟢', color: 'bg-green-600',   placeholder: 'Line ID' },
  { key: 'telegram',    label: 'Telegram',  icon: '✈️', color: 'bg-sky-500',     placeholder: '@用户名' },
  { key: 'website',     label: '个人网站',  icon: '🌐', color: 'bg-violet-500',  placeholder: 'https://...' },
]

type SocialValues = Record<SocialKey, string>
const EMPTY_SOCIALS: SocialValues = {
  wechat: '', whatsapp: '', xiaohongshu: '', facebook: '',
  instagram: '', line: '', telegram: '', website: '',
}

// OTP helpers
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}
const COOLDOWN = 60

// ─────────────────────────────────────────────────────────────────────────────
export default function VerificationSection({ user }: Props) {

  // ── phone OTP state ───────────────────────────────────────────────────────
  const [dbPhone,       setDbPhone]       = useState<string | null>(null)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [step,          setStep]          = useState<'idle' | 'entering' | 'otp'>('idle')
  const [phoneInput,    setPhoneInput]    = useState('')
  const [otpInput,      setOtpInput]      = useState('')
  const [phoneMsg,      setPhoneMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [sending,       setSending]       = useState(false)
  const [verifying,     setVerifying]     = useState(false)
  const [countdown,     setCountdown]     = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── social links state ────────────────────────────────────────────────────
  const [socials,      setSocials]      = useState<SocialValues>(EMPTY_SOCIALS)
  const [editSocials,  setEditSocials]  = useState<SocialValues>(EMPTY_SOCIALS)
  const [editingLinks, setEditingLinks] = useState(false)
  const [savingLinks,  setSavingLinks]  = useState(false)
  const [linksMsg,     setLinksMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  // ── doc upload state ──────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading,  setUploading]  = useState(false)
  const [docUrl,     setDocUrl]     = useState<string | null>(null)
  const [uploadMsg,  setUploadMsg]  = useState<{ ok: boolean; text: string } | null>(null)

  const emailVerified = !!user.email_confirmed_at

  // ── load data on mount ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('users').select('phone, wechat, social_links').eq('id', user.id).single()
      .then(({ data }) => {
        if (!data) return
        setDbPhone(data.phone ?? null)
        const raw = (data.social_links ?? {}) as Partial<SocialValues>
        const loaded: SocialValues = {
          ...EMPTY_SOCIALS,
          wechat:      data.wechat ?? raw.wechat      ?? '',
          whatsapp:    raw.whatsapp    ?? '',
          xiaohongshu: raw.xiaohongshu ?? '',
          facebook:    raw.facebook    ?? '',
          instagram:   raw.instagram   ?? '',
          line:        raw.line        ?? '',
          telegram:    raw.telegram    ?? '',
          website:     raw.website     ?? '',
        }
        setSocials(loaded)
        setEditSocials(loaded)
      })

    if (user.phone) {
      setPhoneVerified(true)
      setDbPhone(prev => prev ?? user.phone ?? null)
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars').getPublicUrl(`${user.id}/verify-doc`)
    fetch(publicUrl, { method: 'HEAD' })
      .then(r => { if (r.ok) setDocUrl(publicUrl) })
      .catch(() => {})
  }, [user.id, user.phone])

  // ── countdown timer ───────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setCountdown(COOLDOWN)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // ── OTP send / verify ─────────────────────────────────────────────────────
  async function sendOtp() {
    const formatted = toE164(phoneInput.trim())
    if (formatted.length < 8) { setPhoneMsg({ ok: false, text: '请输入有效的手机号码' }); return }
    setSending(true); setPhoneMsg(null)
    const { error } = await supabase.auth.updateUser({ phone: formatted })
    setSending(false)
    if (error) {
      setPhoneMsg({ ok: false, text: error.message.includes('not enabled') ? '短信服务暂未开通，请联系管理员' : error.message })
      return
    }
    setStep('otp'); startCountdown()
    setPhoneMsg({ ok: true, text: `验证码已发送至 ${formatted}` })
  }

  async function verifyOtp() {
    if (otpInput.length !== 6) { setPhoneMsg({ ok: false, text: '请输入 6 位验证码' }); return }
    setVerifying(true); setPhoneMsg(null)
    const { error } = await supabase.auth.verifyOtp({
      phone: toE164(phoneInput.trim()), token: otpInput, type: 'phone_change',
    })
    if (error) { setPhoneMsg({ ok: false, text: '验证码错误或已过期' }); setVerifying(false); return }
    const { error: dbErr } = await supabase.from('users').update({ phone: toE164(phoneInput.trim()), phone_verified: true }).eq('id', user.id)
    if (dbErr) { setPhoneMsg({ ok: false, text: '验证成功但保存失败，请稍后重试' }); setVerifying(false); return }
    setDbPhone(toE164(phoneInput.trim())); setPhoneVerified(true)
    setStep('idle'); setPhoneMsg({ ok: true, text: '手机号验证成功 ✓' }); setVerifying(false)
  }

  // ── save social links ─────────────────────────────────────────────────────
  async function saveSocialLinks() {
    setSavingLinks(true); setLinksMsg(null)
    const { wechat, ...rest } = editSocials
    const { error } = await supabase.from('users').update({
      wechat:       wechat.trim() || null,
      social_links: Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, v.trim() || null])
      ),
    }).eq('id', user.id)
    setSavingLinks(false)
    if (error) { setLinksMsg({ ok: false, text: '保存失败，请重试' }); return }
    setSocials({ ...editSocials })
    setEditingLinks(false)
    setLinksMsg({ ok: true, text: '联系方式已保存' })
    setTimeout(() => setLinksMsg(null), 3000)
  }

  // ── doc upload ────────────────────────────────────────────────────────────
  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 5 * 1024 * 1024) { setUploadMsg({ ok: false, text: '文件不能超过 5MB' }); return }
    setUploading(true); setUploadMsg(null)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${user.id}/verify-doc.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      setDocUrl(publicUrl)
      setUploadMsg({ ok: true, text: '上传成功，我们将在 1-3 个工作日内完成审核' })
    } catch (err) {
      setUploadMsg({ ok: false, text: '上传失败：' + (err instanceof Error ? err.message : '请重试') })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // count filled platforms for summary
  const filledCount = PLATFORMS.filter(p => socials[p.key]?.trim()).length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      key="verification"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
      className="flex-1 px-4 py-6 max-w-md lg:max-w-none mx-auto w-full space-y-4"
    >

      {/* ── 身份验证 ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-sm font-semibold text-gray-700">身份验证</h3>
          <p className="text-xs text-gray-400 mt-0.5">完成验证后您的服务将获得更高曝光</p>
        </div>

        {/* Email */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100">
          <Mail size={16} className="text-gray-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-800">邮箱验证</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          {emailVerified
            ? <Badge green>已验证</Badge>
            : <Badge amber>未验证</Badge>}
        </div>

        {/* Phone */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100">
          <Phone size={16} className="text-gray-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-800">手机号验证</p>
            <p className="text-xs text-gray-400">{dbPhone ?? '未填写'}</p>
          </div>
          {phoneVerified
            ? <Badge green>已验证</Badge>
            : <button onClick={() => { setStep('entering'); setPhoneMsg(null); setPhoneInput(dbPhone ?? '') }}
                className="text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-1 rounded-full font-medium transition-colors">
                去验证
              </button>}
        </div>

        {/* Phone OTP flow */}
        <AnimatePresence>
          {step !== 'idle' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-gray-100">
              <div className="px-5 py-4 space-y-3">
                {step === 'entering' && (
                  <>
                    <p className="text-xs text-gray-500">输入手机号，我们将发送 6 位验证码</p>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 flex-shrink-0">
                        <span className="text-sm">🇨🇦</span>
                        <span className="text-sm text-gray-600">+1</span>
                      </div>
                      <input type="tel" placeholder="647 123 4567" value={phoneInput}
                        onChange={e => setPhoneInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendOtp()}
                        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-300" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setStep('idle'); setPhoneMsg(null) }}
                        className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors">
                        取消
                      </button>
                      <button onClick={sendOtp} disabled={sending}
                        className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-xl py-2.5 font-medium transition-colors disabled:opacity-60">
                        <Send size={13} />{sending ? '发送中…' : '发送验证码'}
                      </button>
                    </div>
                  </>
                )}
                {step === 'otp' && (
                  <>
                    <p className="text-xs text-gray-500">
                      验证码已发送至 <span className="font-medium text-gray-700">{toE164(phoneInput)}</span>
                    </p>
                    <input type="text" inputMode="numeric" maxLength={6}
                      placeholder="输入 6 位验证码" value={otpInput}
                      onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                      className="w-full text-center text-xl tracking-[0.5em] font-mono border border-gray-200 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-primary-300" />
                    <button onClick={verifyOtp} disabled={verifying || otpInput.length !== 6}
                      className="w-full flex items-center justify-center gap-1.5 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-xl py-2.5 font-medium disabled:opacity-60">
                      <CheckCircle2 size={13} />{verifying ? '验证中…' : '确认验证'}
                    </button>
                    <div className="flex justify-between">
                      <button onClick={() => { setStep('entering'); setOtpInput('') }}
                        className="text-xs text-gray-400 hover:text-gray-600">修改号码</button>
                      <button onClick={sendOtp} disabled={countdown > 0 || sending}
                        className="flex items-center gap-1 text-xs text-primary-600 disabled:text-gray-400">
                        <RefreshCw size={11} />
                        {countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送'}
                      </button>
                    </div>
                  </>
                )}
                {phoneMsg && <FeedbackMsg msg={phoneMsg} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 联系方式 & 社交媒体 ──────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">联系方式 & 社交媒体</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {filledCount > 0 ? `已填写 ${filledCount} 个平台` : '添加后客户可通过多种渠道联系您'}
            </p>
          </div>
          {!editingLinks && (
            <button onClick={() => { setEditingLinks(true); setEditSocials({ ...socials }); setLinksMsg(null) }}
              className="flex items-center gap-1 text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-full font-medium transition-colors">
              <Pencil size={11} /> 编辑
            </button>
          )}
        </div>

        {/* View mode — only show filled platforms */}
        {!editingLinks && (
          <div className="border-t border-gray-100 divide-y divide-gray-100">
            {filledCount === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-gray-400">
                暂未填写任何联系方式，点击「编辑」添加
              </div>
            ) : (
              PLATFORMS.filter(p => socials[p.key]?.trim()).map(p => (
                <div key={p.key} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={`w-8 h-8 ${p.color} rounded-xl flex items-center justify-center text-base flex-shrink-0`}>
                    {p.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">{p.label}</p>
                    <p className="text-sm text-gray-800 truncate">{socials[p.key]}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Edit mode — show all platforms */}
        <AnimatePresence>
          {editingLinks && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="border-t border-gray-100 divide-y divide-gray-100">
              {PLATFORMS.map(p => (
                <div key={p.key} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-8 h-8 ${p.color} rounded-xl flex items-center justify-center text-base flex-shrink-0`}>
                    {p.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-1">{p.label}{p.hint && <span className="ml-1 text-gray-300">· {p.hint}</span>}</p>
                    <input
                      type={p.key === 'website' ? 'url' : 'text'}
                      placeholder={p.placeholder}
                      value={editSocials[p.key]}
                      onChange={e => setEditSocials(prev => ({ ...prev, [p.key]: e.target.value }))}
                      className="w-full text-sm border-b border-gray-200 outline-none focus:border-primary-400 bg-transparent py-0.5 placeholder-gray-300"
                    />
                  </div>
                </div>
              ))}

              {linksMsg && <div className="px-5 py-2"><FeedbackMsg msg={linksMsg} /></div>}

              <div className="flex gap-2 px-5 py-4">
                <button onClick={() => { setEditingLinks(false); setLinksMsg(null) }}
                  className="flex-1 flex items-center justify-center gap-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors">
                  <X size={13} /> 取消
                </button>
                <button onClick={saveSocialLinks} disabled={savingLinks}
                  className="flex-1 flex items-center justify-center gap-1 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-xl py-2.5 font-medium transition-colors disabled:opacity-60">
                  <Check size={13} /> {savingLinks ? '保存中…' : '保存'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {linksMsg && !editingLinks && (
          <div className="px-5 pb-4"><FeedbackMsg msg={linksMsg} /></div>
        )}
      </div>

      {/* ── 商户资质认证 ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-gray-700">商户资质认证</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            上传营业执照、资格证书等材料，通过后服务将显示
            <span className="text-blue-600 font-medium"> ✓ 已认证</span> 标志
          </p>
        </div>
        <div className="px-5 pb-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mt-3 mb-2">接受以下材料（任选其一）：</p>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
            <li>营业执照 / Business Registration</li>
            <li>职业资格证书（驾照、厨师证、建筑证等）</li>
            <li>专业认证证书（CPA、律师执照等）</li>
            <li>其他政府颁发的资质证明</li>
          </ul>
          <p className="text-xs text-gray-400 mt-2">支持 JPG、PNG、PDF，最大 5MB</p>
        </div>
        <div className="px-5 pb-5 border-t border-gray-100">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf"
            className="hidden" onChange={handleDocUpload} />
          {docUrl ? (
            <div className="mt-3 flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-4">
              <FileCheck size={20} className="text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-700">文件已上传</p>
                <p className="text-xs text-green-600 mt-0.5">审核中，预计 1-3 个工作日</p>
              </div>
              <button onClick={() => fileRef.current?.click()}
                className="text-xs text-green-600 underline flex-shrink-0">重新上传</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="mt-3 w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-8 text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-colors disabled:opacity-60">
              <Upload size={24} />
              <span className="text-sm">{uploading ? '上传中…' : '点击上传资质证明'}</span>
            </button>
          )}
          {uploadMsg && <div className="mt-3"><FeedbackMsg msg={uploadMsg} /></div>}
        </div>
      </div>

      {/* ── 认证说明 ──────────────────────────────────────────────────────── */}
      <div className="bg-blue-50 rounded-3xl px-5 py-4 flex gap-3">
        <ShieldCheck size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-blue-700">认证的好处</p>
          <p className="text-xs text-blue-600 mt-1 leading-relaxed">
            通过认证的服务商将获得蓝色盾牌标志，在搜索结果中优先排序，帮助客户建立信任、提高接单率。
          </p>
        </div>
      </div>

    </motion.div>
  )
}

// ── Shared small components ───────────────────────────────────────────────────
function Badge({ green, amber, children }: { green?: boolean; amber?: boolean; children: React.ReactNode }) {
  const cls = green
    ? 'text-green-600 bg-green-50'
    : amber
    ? 'text-amber-600 bg-amber-50'
    : 'text-gray-400 bg-gray-100'
  return (
    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${cls}`}>
      {green && <CheckCircle2 size={12} />}
      {amber && <AlertCircle size={12} />}
      {children}
    </span>
  )
}

function FeedbackMsg({ msg }: { msg: { ok: boolean; text: string } }) {
  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl
      ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
      {msg.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
      {msg.text}
    </div>
  )
}
