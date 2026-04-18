// ─── Referral Section ──────────────────────────────────────────────────────────
// Shows the user's personal share code, referral count, and one-click share buttons.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Users, Gift } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Props { user: SupabaseUser }

const BASE_URL = 'https://toronto-chinese-services.vercel.app'

export default function ReferralSection({ user }: Props) {
  const [referralCode,  setReferralCode]  = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState<number>(0)
  const [copied,        setCopied]        = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)

  async function loadReferralData(code: string) {
    setReferralCode(code)

    const { count, error: countError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by_code', code)

    if (countError) throw countError
    setReferralCount(count ?? 0)
  }

  useEffect(() => {
    let active = true

    const bootstrapReferral = async () => {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single()

      if (!active) return
      if (fetchError) {
        setError('分享码加载失败，请稍后再试')
        setLoading(false)
        return
      }

      let code = data?.referral_code ?? null

      if (!code) {
        const { data: repairedCode, error: repairError } = await supabase.rpc('ensure_my_referral_code')
        if (!active) return
        if (repairError) {
          setError('你的分享码暂时还没生成，请联系管理员执行邀请码修复 SQL')
          setLoading(false)
          return
        }
        code = repairedCode
      }

      if (!code) {
        setError('你的分享码暂时还没生成，请联系管理员执行邀请码修复 SQL')
        setLoading(false)
        return
      }

      try {
        await loadReferralData(code)
      } catch {
        if (!active) return
        setError('分享码统计加载失败，请稍后再试')
      } finally {
        if (active) setLoading(false)
      }
    }

    void bootstrapReferral()

    return () => {
      active = false
    }
  }, [user.id])

  const shareBaseUrl = typeof window !== 'undefined' ? window.location.origin : BASE_URL
  const shareUrl  = referralCode ? `${shareBaseUrl}/register?ref=${referralCode}` : ''
  const shareText = `我在多伦多华人服务平台找到了很多靠谱的本地服务商！用我的邀请码 ${referralCode} 注册：`

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareToFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank', 'width=600,height=400'
    )
  }

  function shareToWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`,
      '_blank'
    )
  }

  async function copyForWeChat() {
    await navigator.clipboard.writeText(shareText + '\n' + shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">
      加载中…
    </div>
  )

  return (
    <motion.div
      key="referral"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
      className="flex-1 px-4 py-6 max-w-md lg:max-w-none mx-auto w-full space-y-4"
    >

      {/* ── My referral code ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-gray-700">我的分享码</h3>
          <p className="text-xs text-gray-400 mt-0.5">朋友注册时输入此码，即算你的邀请</p>
        </div>

        {/* Code display */}
        <div className="mx-5 mb-5 bg-gradient-to-br from-primary-50 to-red-50 border border-primary-100 rounded-2xl p-5">
          <p className="text-center font-mono text-3xl font-bold tracking-[0.3em] text-primary-700 select-all mb-4">
            {referralCode ?? '------'}
          </p>
          {error && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {error}
            </p>
          )}
          <button
            onClick={copyLink}
            disabled={!shareUrl}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                       disabled:bg-gray-300 disabled:cursor-not-allowed
                       text-white text-sm font-semibold py-3 rounded-xl transition-colors active:scale-95"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? '已复制链接！' : '复制邀请链接'}
          </button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Users size={22} className="text-primary-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{referralCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">位朋友通过你的分享码注册</p>
        </div>
      </div>

      {/* ── Share buttons ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-gray-700">一键分享</h3>
        </div>
        <div className="border-t border-gray-100 divide-y divide-gray-100">

          {/* Facebook */}
          <button
            onClick={shareToFacebook}
            disabled={!shareUrl}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0">
              👥
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Facebook</p>
              <p className="text-xs text-gray-400">分享到 Facebook</p>
            </div>
          </button>

          {/* WhatsApp */}
          <button
            onClick={shareToWhatsApp}
            disabled={!shareUrl}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0">
              📲
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">WhatsApp</p>
              <p className="text-xs text-gray-400">发送给 WhatsApp 联系人</p>
            </div>
          </button>

          {/* WeChat */}
          <button
            onClick={copyForWeChat}
            disabled={!shareUrl}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0">
              💬
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">微信</p>
              <p className="text-xs text-gray-400">复制链接，在微信中粘贴发送</p>
            </div>
            {copied && <span className="text-xs text-green-600 font-medium flex-shrink-0">已复制 ✓</span>}
          </button>

        </div>
      </div>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <div className="bg-amber-50 rounded-3xl px-5 py-4 flex gap-3">
        <Gift size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-700">邀请说明</p>
          <p className="text-xs text-amber-600 mt-1 leading-relaxed">
            将链接分享给朋友，朋友点击链接注册后，邀请码会自动填入。
            注册成功后，你的邀请人数会 +1。
          </p>
        </div>
      </div>

    </motion.div>
  )
}
