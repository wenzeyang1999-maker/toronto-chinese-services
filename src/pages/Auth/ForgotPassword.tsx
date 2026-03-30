// ─── Forgot Password Page ──────────────────────────────────────────────────────
// Route: /forgot-password
// Sends a password reset email via Supabase Auth.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ChevronLeft, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail]           = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading]       = useState(false)
  const [sent, setSent]             = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setEmailError('请输入邮箱'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('邮箱格式不正确'); return }

    setLoading(true)
    setServerError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)

    if (error) {
      setServerError(`发送失败：${error.message}`)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="w-full bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-3">
        <Link to="/login" className="text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft size={22} />
        </Link>
        <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
          T
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
        >
          {sent ? (
            <div className="text-center">
              <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">邮件已发送</h2>
              <p className="text-sm text-gray-500 mb-6">
                重置密码链接已发送到 <strong>{email}</strong>，请查收邮件并点击链接重置密码。
              </p>
              <Link to="/login" className="text-primary-600 text-sm font-medium hover:underline">
                返回登录
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">忘记密码</h1>
                <p className="text-sm text-gray-500">输入注册邮箱，我们将发送重置链接</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">邮箱</label>
                  <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-4 py-3
                                  focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-transparent
                                  transition-all bg-white">
                    <span className="text-gray-400 flex-shrink-0"><Mail size={16} /></span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                      placeholder="example@email.com"
                      className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                    />
                  </div>
                  {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
                </div>

                {serverError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3">
                    {serverError}
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: loading ? 1 : 0.97 }}
                  className="w-full bg-primary-600 text-white py-3.5 rounded-2xl font-semibold text-sm
                             hover:bg-primary-700 transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? '发送中...' : '发送重置邮件'}
                </motion.button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                想起密码了？{' '}
                <Link to="/login" className="text-primary-600 font-medium hover:underline">
                  返回登录
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
