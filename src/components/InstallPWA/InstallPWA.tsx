// ─── InstallPWA ──────────────────────────────────────────────────────────────
// Bottom banner that prompts users to install the site as a PWA.
//   • Android / Chrome / Edge: triggers the native beforeinstallprompt flow.
//   • iOS Safari: shows manual instructions (no API; user must use Share menu).
//   • Hidden when already installed or when user dismissed.
import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'
import { isIos, isStandalone } from '../../lib/pwa'

const DISMISSED_KEY = 'tcs_pwa_install_dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosOpen,  setIosOpen]  = useState(false)
  const [hidden,   setHidden]   = useState(true)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    setHidden(false)

    if (isIos()) return // iOS path uses static instructions

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setHidden(true)
    setIosOpen(false)
  }

  async function install() {
    if (deferred) {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted' || outcome === 'dismissed') dismiss()
      setDeferred(null)
    } else if (isIos()) {
      setIosOpen(true)
    }
  }

  if (hidden) return null
  if (!deferred && !isIos()) return null // No install path available

  return (
    <>
      {/* Bottom banner */}
      <div className="fixed bottom-3 left-3 right-3 lg:left-auto lg:right-6 lg:bottom-6 lg:max-w-sm z-[60]">
        <div className="bg-white border border-primary-100 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Download size={18} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">把 NCC 装到主屏幕</p>
            <p className="text-xs text-gray-500 mt-0.5">收消息更及时，打开更快</p>
          </div>
          <button onClick={install}
            className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors flex-shrink-0">
            安装
          </button>
          <button onClick={dismiss}
            className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
            aria-label="关闭">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* iOS instructions modal */}
      {iosOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end lg:items-center justify-center"
          onClick={dismiss}>
          <div className="bg-white rounded-t-3xl lg:rounded-3xl w-full lg:max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">安装 NCC</h3>
              <button onClick={dismiss} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              在 iPhone 上安装为应用：
            </p>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 font-bold text-xs flex items-center justify-center">1</span>
                <span>点击 Safari 底部的<span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold"><Share size={12} /> 分享</span>按钮</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 font-bold text-xs flex items-center justify-center">2</span>
                <span>向下滚动，选「<strong>添加到主屏幕</strong>」</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 font-bold text-xs flex items-center justify-center">3</span>
                <span>点右上角「添加」</span>
              </li>
            </ol>
            <p className="text-xs text-gray-400">
              提示：必须用 Safari 打开，Chrome 等浏览器无法添加到主屏幕。
            </p>
            <button onClick={dismiss}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors">
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  )
}
