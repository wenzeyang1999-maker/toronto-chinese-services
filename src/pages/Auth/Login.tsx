// ─── Login Page ───────────────────────────────────────────────────────────────
// Route: /login
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'

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

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm]           = useState<LoginForm>({ email: '', password: '' })
  const [errors, setErrors]       = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

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

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    setLoading(false)

    if (error) {
      setServerError('邮箱或密码不正确，请重试')
      return
    }

    navigate('/')
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">欢迎回来</h1>
            <p className="text-sm text-gray-500">登录多伦多华人服务平台</p>
          </div>

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
              <span className="text-xs text-primary-600 cursor-pointer hover:underline">
                忘记密码？
              </span>
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">或</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Register link */}
          <p className="text-center text-sm text-gray-500">
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
