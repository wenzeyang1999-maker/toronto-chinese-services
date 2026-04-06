// ─── Register Page ────────────────────────────────────────────────────────────
// User registration UI. Collected fields are ready to POST to a backend.
// Database integration to be added later — for now, form validates locally only.
//
// Route: /register
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, User, Phone, Lock, Mail, ChevronLeft, Gift } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface RegisterForm {
  name: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

interface FormErrors {
  name?: string
  email?: string
  phone?: string
  password?: string
  confirmPassword?: string
}

const INITIAL: RegisterForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
}

// ── Validation ────────────────────────────────────────────────────────────────
function validate(form: RegisterForm): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim())
    errors.name = '请输入姓名'
  if (!form.email.trim())
    errors.email = '请输入邮箱'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = '邮箱格式不正确'
  if (!form.phone.trim())
    errors.phone = '请输入手机号'
  if (!form.password)
    errors.password = '请设置密码'
  else if (form.password.length < 8)
    errors.password = '密码至少 8 位'
  if (form.confirmPassword !== form.password)
    errors.confirmPassword = '两次密码不一致'
  return errors
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm]             = useState<RegisterForm>(INITIAL)
  const [referralCode, setReferralCode] = useState('')

  // Auto-fill referral code from URL param ?ref=XXXX
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) setReferralCode(ref.toUpperCase())
  }, [searchParams])
  const [errors, setErrors]         = useState<FormErrors>({})
  const [showPassword, setShowPassword]         = useState(false)
  const [showConfirm, setShowConfirm]           = useState(false)
  const [agreedToTerms, setAgreedToTerms]       = useState(false)
  const [termsError, setTermsError]             = useState(false)
  const [loading, setLoading]                   = useState(false)
  const [serverError, setServerError]           = useState<string | null>(null)
  const [emailExists, setEmailExists]           = useState(false)
  const [success, setSuccess]                   = useState(false)

  const update = (field: keyof RegisterForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
    setServerError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!agreedToTerms) { setTermsError(true); return }
    setTermsError(false)

    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    setServerError(null)
    setEmailExists(false)

    // Create auth user — the DB trigger handle_new_user() will automatically
    // insert into public.users using SECURITY DEFINER (bypasses RLS).
    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name,
          phone: form.phone.trim() || null,
          referred_by_code: referralCode.trim().toUpperCase() || null,
        },
      },
    })

    if (authError) {
      const msg = authError.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
        setEmailExists(true)
      } else {
        setServerError(authError.message)
      }
      setLoading(false)
      return
    }

    setLoading(false)
    setSuccess(true)
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">注册成功！</h2>
          <p className="text-sm text-gray-500 mb-6">
            我们已发送一封验证邮件到 <span className="font-medium text-gray-700">{form.email}</span>，
            请查收并点击链接激活账号。
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-primary-600 text-white py-3 rounded-2xl font-medium text-sm hover:bg-primary-700 transition-colors"
          >
            返回首页
          </button>
        </motion.div>
      </div>
    )
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
        <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
          T
        </div>
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
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">创建账号</h1>
            <p className="text-sm text-gray-500">加入多伦多华人服务平台</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <Field label="姓名" error={errors.name}>
              <InputRow icon={<User size={16} />}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="您的称呼"
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                />
              </InputRow>
            </Field>

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

            {/* Phone */}
            <Field label="手机号" error={errors.phone}>
              <InputRow icon={<Phone size={16} />}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="647-xxx-xxxx"
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
                  placeholder="至少 8 位"
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

            {/* Confirm password */}
            <Field label="确认密码" error={errors.confirmPassword}>
              <InputRow icon={<Lock size={16} />}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  placeholder="再输入一次"
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </InputRow>
            </Field>

            {/* Referral code (optional) */}
            <Field label="邀请码（选填）">
              <InputRow icon={<Gift size={16} />}>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="朋友的分享码"
                  maxLength={7}
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 uppercase tracking-widest"
                />
              </InputRow>
            </Field>

            {/* Terms */}
            <div className="flex items-start gap-2 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => { setAgreedToTerms(e.target.checked); setTermsError(false) }}
                className="mt-0.5 accent-primary-600"
              />
              <label htmlFor="terms" className="text-xs text-gray-500 leading-relaxed">
                我已阅读并同意{' '}
                <span className="text-primary-600 cursor-pointer hover:underline">服务条款</span>
                {' '}及{' '}
                <span className="text-primary-600 cursor-pointer hover:underline">隐私政策</span>
              </label>
            </div>
            {termsError && (
              <p className="text-xs text-red-500 -mt-2">请先同意服务条款</p>
            )}

            {/* Duplicate email */}
            {emailExists && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded-xl px-4 py-3">
                此邮箱已注册。{' '}
                <Link to="/login" className="font-medium underline">
                  立即登录
                </Link>
              </div>
            )}

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
              {loading ? '注册中...' : '注册'}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">或</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Login link */}
          <p className="text-center text-sm text-gray-500">
            已有账号？{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              立即登录
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
