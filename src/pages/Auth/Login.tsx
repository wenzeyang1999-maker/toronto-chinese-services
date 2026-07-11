// ─── Login Page ───────────────────────────────────────────────────────────────
// Route: /login
import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, ChevronLeft, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import HuaLinLogo from '../../components/Logo/HuaLinLogo'
import SocialAuthButtons from './SocialAuthButtons'

interface LoginForm {
  email: string
  password: string
}

interface FormErrors {
  email?: string
  password?: string
}

function validate(form: LoginForm): FormErrors {
  const errors: FormErrors = {}
  if (!form.email.trim())
    errors.email = '请输入邮箱'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = '邮箱格式不正确'
  if (!form.password)
    errors.password = '请输入密码'
  return errors
}

// North-American number → E.164 (matches send-otp's normalisation)
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm]           = useState<LoginForm>({ email: '', password: '' })
  const [errors, setErrors]       = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // ── Phone OTP login (Supabase native phone auth) ──────────────────────────
  const [authMode, setAuthMode]   = useState<'email' | 'phone'>('email')
  const [phone, setPhone]         = useState('')
  const [otpSent, setOtpSent]     = useState(false)
  const [otpCode, setOtpCode]     = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneError, setPhoneError]     = useState<string | null>(null)

  const gotoAfterLogin = () => navigate((location.state as { from?: string })?.from || '/')

  async function sendPhoneOtp() {
    const e164 = toE164(phone)
    if (e164.replace(/\D/g, '').length < 10) { setPhoneError('手机号格式不正确'); return }
    setPhoneLoading(true); setPhoneError(null)
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 })
    setPhoneLoading(false)
    if (error) { setPhoneError('验证码发送失败，请稍后重试'); return }
    setOtpSent(true)
  }

  async function verifyPhoneOtp() {
    if (otpCode.trim().length !== 6) { setPhoneError('请输入 6 位验证码'); return }
    setPhoneLoading(true); setPhoneError(null)
    const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: otpCode.trim(), type: 'sms' })
    setPhoneLoading(false)
    if (error) { setPhoneError('验证码错误或已过期，请重试'); return }
    gotoAfterLogin()
  }

  const update = (field: keyof LoginForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
    setServerError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    setServerError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (error) {
      setLoading(false)
      const msg = error.message.toLowerCase()
      if (msg.includes('email not confirmed')) {
        setServerError('邮箱尚未验证，请查收注册邮件并点击验证链接后再登录')
      } else {
        setServerError('邮箱或密码不正确，请重试')
      }
      return
    }

    const userId = data.user?.id
    if (userId) {
      const { data: profile, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (roleError) {
        await supabase.auth.signOut()
        setLoading(false)
        setServerError('登录后校验账号状态失败，请稍后重试')
        return
      }

      if (profile?.role === 'banned') {
        await supabase.auth.signOut()
        setLoading(false)
        setServerError('该账号已被封禁，如有疑问请联系管理员')
        return
      }
    }

    setLoading(false)
    navigate((location.state as { from?: string })?.from || '/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="w-full bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <HuaLinLogo variant="icon" size={28} />
      </div>

      {/* Form card */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
        >
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">欢迎回来</h1>
            <p className="text-sm text-gray-500">登录华邻</p>
          </div>

          {/* OAuth buttons */}
          <SocialAuthButtons
            redirectTo={`${window.location.origin}${(location.state as { from?: string })?.from ?? '/'}`}
          />

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">或</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Email ↔ Phone toggle */}
          <div className="grid grid-cols-2 gap-1 mb-5 bg-gray-100 p-1 rounded-xl">
            {(['email', 'phone'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setAuthMode(m); setServerError(null); setPhoneError(null) }}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  authMode === m ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'
                }`}
              >
                {m === 'email' ? '邮箱登录' : '手机验证码'}
              </button>
            ))}
          </div>

          {authMode === 'email' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <Field label="邮箱" error={errors.email}>
              <InputRow icon={<Mail size={16} />}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="example@email.com"
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                />
              </InputRow>
            </Field>

            {/* Password */}
            <Field label="密码" error={errors.password}>
              <InputRow icon={<Lock size={16} />}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="请输入密码"
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </InputRow>
            </Field>

            {/* Forgot password */}
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">
                忘记密码？
              </Link>
            </div>

            {/* Server error */}
            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3">
                {serverError}
              </div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              className="w-full bg-primary-600 text-white py-3.5 rounded-2xl font-semibold text-sm
                         hover:bg-primary-700 transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '登录中...' : '登录'}
            </motion.button>
          </form>
          ) : (
          <div className="space-y-4">
            {/* Phone */}
            <Field label="手机号">
              <InputRow icon={<Phone size={16} />}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !otpSent && sendPhoneOtp()}
                  placeholder="10 位手机号"
                  disabled={otpSent}
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 disabled:opacity-60"
                />
              </InputRow>
            </Field>

            {/* Code */}
            {otpSent && (
              <Field label="验证码">
                <InputRow icon={<Lock size={16} />}>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && verifyPhoneOtp()}
                    placeholder="6 位验证码"
                    autoFocus
                    className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 tracking-widest"
                  />
                </InputRow>
              </Field>
            )}

            {phoneError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3">
                {phoneError}
              </div>
            )}

            {!otpSent ? (
              <motion.button
                type="button"
                onClick={sendPhoneOtp}
                disabled={phoneLoading}
                whileTap={{ scale: phoneLoading ? 1 : 0.97 }}
                className="w-full bg-primary-600 text-white py-3.5 rounded-2xl font-semibold text-sm
                           hover:bg-primary-700 transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {phoneLoading ? '发送中...' : '获取验证码'}
              </motion.button>
            ) : (
              <>
                <motion.button
                  type="button"
                  onClick={verifyPhoneOtp}
                  disabled={phoneLoading}
                  whileTap={{ scale: phoneLoading ? 1 : 0.97 }}
                  className="w-full bg-primary-600 text-white py-3.5 rounded-2xl font-semibold text-sm
                             hover:bg-primary-700 transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {phoneLoading ? '登录中...' : '登录'}
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtpCode(''); setPhoneError(null) }}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  改号码 / 重新获取
                </button>
              </>
            )}

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              未注册的手机号将自动创建账号
            </p>
          </div>
          )}

          {/* Register link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            还没有账号？{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              立即注册
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function InputRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-4 py-3
                    focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-transparent
                    transition-all bg-white">
      <span className="text-gray-400 flex-shrink-0">{icon}</span>
      {children}
    </div>
  )
}
