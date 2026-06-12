// ─── InquiryClaim ─────────────────────────────────────────────────────────────
// Route: /inquiries/:id/claim
// Providers land here from the "立即抢单" email link.
// Auto-calls accept_inquiry RPC when mounted if user is logged in.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Zap, LogIn } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

type ClaimState = 'loading' | 'claimed' | 'full' | 'not_found' | 'need_login' | 'error'

export default function InquiryClaim() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const [state,      setState]      = useState<ClaimState>('loading')
  const [slotCount,  setSlotCount]  = useState<number | null>(null)

  useEffect(() => {
    if (!id) { setState('not_found'); return }
    if (!user) { setState('need_login'); return }

    supabase.rpc('accept_inquiry', { p_inquiry_id: id, p_provider_id: user.id })
      .then(({ data, error }) => {
        if (error) { setState('error'); return }
        const result = data as { ok: boolean; count?: number; error?: string; already_accepted?: boolean }
        if (!result.ok) {
          setState(result.error === 'not_found' ? 'not_found' : 'full')
          return
        }
        setSlotCount(result.count ?? null)
        setState('claimed')
      })
  }, [id, user?.id])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 max-w-sm w-full text-center"
      >
        {state === 'loading' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <Zap size={28} className="text-primary-600 animate-pulse" />
            </div>
            <p className="text-base font-semibold text-gray-700">正在抢单…</p>
          </>
        )}

        {state === 'claimed' && (
          <>
            <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">抢单成功！</h2>
            {slotCount != null && (
              <p className="text-sm text-gray-500 mb-1">当前 {slotCount}/5 名服务商已接单</p>
            )}
            <p className="text-sm text-gray-500 mb-6">客户将通过平台联系您，请保持电话畅通。</p>
            <button onClick={() => navigate('/')}
              className="w-full py-3 bg-primary-600 text-white font-bold rounded-2xl text-sm hover:bg-primary-700 transition-colors">
              返回首页
            </button>
          </>
        )}

        {state === 'full' && (
          <>
            <div className="text-5xl mb-4">😔</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">名额已满</h2>
            <p className="text-sm text-gray-400 mb-6">5 名服务商已接单，此询价已关闭。</p>
            <button onClick={() => navigate('/')}
              className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-sm hover:bg-gray-200 transition-colors">
              返回首页
            </button>
          </>
        )}

        {state === 'not_found' && (
          <>
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">询价不存在</h2>
            <p className="text-sm text-gray-400 mb-6">该询价已过期或被取消。</p>
            <button onClick={() => navigate('/')}
              className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-sm hover:bg-gray-200 transition-colors">
              返回首页
            </button>
          </>
        )}

        {state === 'need_login' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <LogIn size={28} className="text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">请先登录</h2>
            <p className="text-sm text-gray-500 mb-6">登录后即可抢单接客。</p>
            <button onClick={() => navigate('/login', { state: { from: `/inquiries/${id}/claim` } })}
              className="w-full py-3 bg-primary-600 text-white font-bold rounded-2xl text-sm hover:bg-primary-700 transition-colors">
              登录
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">操作失败</h2>
            <p className="text-sm text-gray-400 mb-6">请稍后重试。</p>
            <button onClick={() => setState('loading')}
              className="w-full py-3 bg-primary-600 text-white font-bold rounded-2xl text-sm hover:bg-primary-700 transition-colors">
              重试
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}
