// ─── Reset Password Page ───────────────────────────────────────────────────────
// Route: /reset-password
//
// Supabase JS processes the auth token from the URL hash SYNCHRONOUSLY on init,
// before any React component mounts. By the time useEffect runs, the hash is
// already cleared and the PASSWORD_RECOVERY event has already fired.
//
// Fix: read the URL hash / query at module load time (before Supabase clears it),
// then use that flag to decide which flow to run inside the effect.

import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, CheckCircle, ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ── Read URL BEFORE Supabase clears the hash (module-level, runs once) ────────
const _hash   = new URLSearchParams(window.location.hash.replace(/^#/, ''))
const _query  = new URLSearchParams(window.location.search)
const IS_RECOVERY = _hash.get('type') === 'recovery'   // implicit flow
const PKCE_CODE   = _query.get('code') ?? null          // PKCE flow
// ─────────────────────────────────────────────────────────────────────────────

type Stage = 'loading' | 'form' | 'success' | 'invalid'

export default function ResetPassword() {
  const navigate     = useNavigate()
  const [stage,       setStage]       = useState<Stage>('loading')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const resolved = useRef(false)

  function resolve(to: Stage) {
    if (resolved.current) return
    resolved.current = true
    setStage(to)
  }

  useEffect(() => {
    // ── PKCE flow: ?code=xxx ────────────────────────────────────────────────
    if (PKCE_CODE) {
      supabase.auth.exchangeCodeForSession(PKCE_CODE).then(({ error }) => {
        resolve(error ? 'invalid' : 'form')
      })
      return
    }

    // ── Implicit flow: #access_token=...&type=recovery ──────────────────────
    if (IS_RECOVERY) {
      // Supabase has already processed the hash and set up the session.
      // getSession() gives us that session synchronously.
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          resolve('form')
        }
        // If session not yet ready, the onAuthStateChange below will catch it
      })
    }

    // onAuthStateChange as a safety net (covers edge cases / slow processing)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        resolve('form')
      }
      // If Supabase fires SIGNED_IN (not PASSWORD_RECOVERY) but we know this
      // was a recovery link, still show the form
      if (event === 'SIGNED_IN' && IS_RECOVERY) {
        resolve('form')
      }
    })

    // If neither PKCE nor recovery hash detected → invalid link
    if (!IS_RECOVERY && !PKCE_CODE) {
      resolve('invalid')
    }

    // Last-resort timeout
    const timeout = setTimeout(() => resolve('invalid'), 6000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8)  { setError('密码至少需要 8 位'); return }
    if (password !== confirm)  { setError('两次输入的密码不一致'); return }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(`修改失败：${updateError.message}`)
    } else {
      setStage('success')
      await supabase.auth.signOut()
      setTimeout(() => navigate('/login'), 3000)
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
          {stage === 'loading' && (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">正在验证链接…</p>
            </div>
          )}

          {stage === 'invalid' && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Lock size={28} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">链接已失效</h2>
              <p className="text-sm text-gray-500 mb-6">
                重置链接已过期或无效，请重新申请。
              </p>
              <Link to="/forgot-password"
                className="inline-block bg-primary-600 text-white text-sm font-semibold px-6 py-3 rounded-2xl hover:bg-primary-700 transition-colors">
                重新发送邮件
              </Link>
            </div>
          )}

          {stage === 'success' && (
            <div className="text-center">
              <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">密码已重置</h2>
              <p className="text-sm text-gray-500 mb-6">
                密码修改成功，即将跳转到登录页…
              </p>
              <Link to="/login" className="text-primary-600 text-sm font-medium hover:underline">
                立即登录
              </Link>
            </div>
          )}

          {stage === 'form' && (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">设置新密码</h1>
                <p className="text-sm text-gray-500">请输入您的新密码，至少 8 位</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">新密码</label>
                  <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-4 py-3
                                  focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-transparent
                                  transition-all bg-white">
                    <Lock size={16} className="text-gray-400 flex-shrink-0" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="至少 8 位"
                      className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">确认新密码</label>
                  <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-4 py-3
                                  focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-transparent
                                  transition-all bg-white">
                    <Lock size={16} className="text-gray-400 flex-shrink-0" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="再次输入密码"
                      className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: loading ? 1 : 0.97 }}
                  className="w-full bg-primary-600 text-white py-3.5 rounded-2xl font-semibold text-sm
                             hover:bg-primary-700 transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? '保存中…' : '确认修改'}
                </motion.button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
