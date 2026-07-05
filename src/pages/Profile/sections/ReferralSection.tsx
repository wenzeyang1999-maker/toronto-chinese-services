// ─── Referral Section ──────────────────────────────────────────────────────────
// Shows the user's personal share code, referral count, and one-click share buttons.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Users, Gift, Share2, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Props { user: SupabaseUser }

const BASE_URL = 'https://toronto-chinese-services.vercel.app'

export default function ReferralSection({ user }: Props) {
  const [referralCode,  setReferralCode]  = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState<number>(0)
  const [copied,        setCopied]        = useState(false)
  const [showQr,        setShowQr]        = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [reloadKey,     setReloadKey]     = useState(0)

  async function loadReferralData(code: string) {
    setReferralCode(code)

    const { data: count, error: countError } = await supabase.rpc('count_my_referrals')

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
          setError('分享码暂时生成失败，请点下方「重试」或稍后再试')
          setLoading(false)
          return
        }
        code = repairedCode
      }

      if (!code) {
        setError('分享码暂时生成失败，请点下方「重试」或稍后再试')
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
  }, [user.id, reloadKey])

  const shareBaseUrl = typeof window !== 'undefined' ? window.location.origin : BASE_URL
  const shareUrl  = referralCode ? `${shareBaseUrl}/register?ref=${referralCode}` : ''
  const shareText = `我在华邻找到了很多靠谱的本地服务商！用我的邀请码 ${referralCode} 注册：`

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  async function nativeShare() {
    if (!shareUrl) return
    // Native share sheet (mobile) — surfaces WeChat / Messages / etc. directly.
    if (canNativeShare) {
      try {
        await navigator.share({ title: '华邻 — 邀请你加入', text: shareText, url: shareUrl })
        return
      } catch { /* user cancelled — fall through to nothing */ return }
    }
    // Desktop / unsupported: fall back to copying.
    await copyForWeChat()
  }

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
    <div className="flex-1 space-y-3 p-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-1/2 mb-4" />
        <div className="h-12 bg-gray-100 rounded-xl mb-4" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
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
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button onClick={() => setReloadKey((k) => k + 1)}
                className="flex-shrink-0 font-semibold text-amber-700 underline hover:text-amber-800">
                重试
              </button>
            </div>
          )}
          {/* Primary: native share sheet on mobile (WeChat / Messages / …) */}
          {canNativeShare && (
            <button
              onClick={nativeShare}
              disabled={!shareUrl}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                         disabled:bg-gray-300 disabled:cursor-not-allowed
                         text-white text-sm font-semibold py-3 rounded-xl transition-colors active:scale-95 mb-2"
            >
              <Share2 size={15} />
              分享给朋友
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              disabled={!shareUrl}
              className={`flex-1 flex items-center justify-center gap-2
                         disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-semibold py-3 rounded-xl
                         transition-colors active:scale-95 ${
                           canNativeShare
                             ? 'bg-white border border-primary-200 text-primary-700 hover:bg-primary-50'
                             : 'bg-primary-600 hover:bg-primary-700 text-white'
                         }`}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? '已复制！' : '复制链接'}
            </button>
            <button
              onClick={() => setShowQr((v) => !v)}
              disabled={!shareUrl}
              className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4
                         bg-white border border-gray-200 text-gray-600 hover:bg-gray-50
                         disabled:opacity-50 text-sm font-semibold rounded-xl transition-colors active:scale-95"
            >
              <QrCode size={15} />
              二维码
            </button>
          </div>

          {/* QR code — friends scan to open the referral link */}
          {showQr && shareUrl && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 flex flex-col items-center overflow-hidden"
            >
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                <QRCodeSVG value={shareUrl} size={168} level="M" marginSize={0} />
              </div>
              <p className="text-[11px] text-gray-400 mt-2">扫码即可用你的邀请码注册</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Stats + progress ──────────────────────────────────────────────── */}
      {(() => {
        const monthsEarned = Math.floor(referralCount / 10)
        const progress     = referralCount % 10
        const toNext       = progress === 0 ? 10 : 10 - progress
        const pct          = (progress / 10) * 100
        return (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-4 space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Users size={22} className="text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-gray-900">{referralCount}</p>
                <p className="text-xs text-gray-400 mt-0.5">位朋友通过你的分享码注册</p>
              </div>
              {monthsEarned > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-amber-600">{monthsEarned} 个月</p>
                  <p className="text-[11px] text-gray-400">已获黄金</p>
                </div>
              )}
            </div>
            {/* Progress bar toward next reward */}
            <div>
              <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                <span>距下一个月黄金会员</span>
                <span>还差 {toNext} 人</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        )
      })()}

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

      {/* ── Reward rules ──────────────────────────────────────────────────── */}
      <div className="bg-amber-50 rounded-3xl px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs font-bold text-amber-700">邀请奖励规则</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3">
            <span className="text-xl">🥇</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-800">每邀请 10 位好友</p>
              <p className="text-xs text-gray-500 mt-0.5">自动获得黄金会员 +1 个月 · 搜索优先展示</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3">
            <span className="text-xl">🎯</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-800">无上限累计叠加</p>
              <p className="text-xs text-gray-500 mt-0.5">邀请越多，黄金会员时长越长，持续享受优先曝光</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-amber-600 leading-relaxed">
          朋友点击你的链接注册后，邀请码自动填入，注册成功即算一次有效邀请。
          每满 10 人自动续期，无需手动申请。
        </p>
        <div className="border-t border-amber-200 pt-3">
          <p className="text-xs text-amber-700 font-medium">💡 需要服务置顶推广？</p>
          <p className="text-xs text-amber-600 mt-1">
            推流/置顶属于付费推广服务，请直接联系我们洽谈：
            <a href="mailto:support@huarenq.com?subject=置顶推广咨询" className="underline ml-1">support@huarenq.com</a>
          </p>
        </div>
      </div>

    </motion.div>
  )
}
