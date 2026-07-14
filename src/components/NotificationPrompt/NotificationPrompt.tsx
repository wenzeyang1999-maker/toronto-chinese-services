// ─── NotificationPrompt ───────────────────────────────────────────────────────
// A friendly, explained opt-in card for enabling message / order push
// notifications. Replaces the old silent "request on first click" flow so users
// see WHY before the browser's native permission dialog appears (higher accept
// rate, no surprise prompts).
//
// Show conditions (all must hold):
//   • user is logged in
//   • the browser supports the Notification API
//   • permission is still 'default' (not granted / denied)
//   • the user hasn't dismissed this card before
//   • NOT on a non-installed iPhone — there web push needs "add to home screen"
//     first, which the InstallPWA banner already guides. We prompt once they
//     reopen the installed app (standalone).
import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { subscribeToWebPush } from '../../lib/webPush'
import { isIos, isStandalone } from '../../lib/pwa'
import { toast } from '../../lib/toast'

const DISMISSED_KEY = 'tcs_notif_prompt_dismissed'

function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export default function NotificationPrompt() {
  const user = useAuthStore((s) => s.user)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) { setVisible(false); return }
    if (!notificationsSupported()) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(DISMISSED_KEY)) return
    // On a non-installed iPhone, push can't work in a Safari tab — let the
    // InstallPWA banner guide "add to home screen" first.
    if (isIos() && !isStandalone()) return

    // Small delay so it doesn't fight the first paint / other banners.
    const t = window.setTimeout(() => setVisible(true), 1500)
    return () => window.clearTimeout(t)
  }, [user])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  async function enable() {
    if (!user || !notificationsSupported()) return
    setBusy(true)
    try {
      const result = await Notification.requestPermission()
      if (result === 'granted') {
        const ok = await subscribeToWebPush(user.id)
        toast(ok ? '通知已开启，有新消息和订单会提醒你 ✓' : '通知已开启 ✓', 'success')
      } else if (result === 'denied') {
        toast('已拒绝通知。可在「我的 → 帐号和安全 → 通知设置」重新开启', 'info')
      }
    } catch {
      /* some browsers throw if called outside a user gesture — ignore */
    } finally {
      setBusy(false)
      // Either way, don't nag again from this card.
      localStorage.setItem(DISMISSED_KEY, '1')
      setVisible(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-36 left-3 right-3 lg:left-auto lg:right-16 lg:bottom-44 lg:max-w-sm z-[60]">
      <div className="bg-white border border-primary-100 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
          <Bell size={18} className="text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">开启消息 / 订单通知</p>
          <p className="text-xs text-gray-500 mt-0.5">有人联系你或抢单时，第一时间提醒</p>
        </div>
        <button
          onClick={enable}
          disabled={busy}
          className="bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors flex-shrink-0"
        >
          {busy ? '开启中…' : '开启'}
        </button>
        <button
          onClick={dismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
          aria-label="关闭"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
