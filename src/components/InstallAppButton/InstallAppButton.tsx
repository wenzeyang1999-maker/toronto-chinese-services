// ─── InstallAppButton ─────────────────────────────────────────────────────────
// Manual entry to install the site as a PWA. Hides when already installed.
//   • beforeinstallprompt captured → native dialog
//   • iOS Safari → "添加到主屏幕" instructions
//   • Other (desktop Chrome before prompt fires, Firefox, etc.) → generic hint
import { useState } from 'react'
import { Download, Smartphone, Share, X, Monitor } from 'lucide-react'
import { isIos, isStandalone } from '../../lib/pwa'
import { triggerInstall, useInstallState } from '../../lib/pwaInstall'
import { toast } from '../../lib/toast'

export default function InstallAppButton() {
  const { canInstall, installed } = useInstallState()
  const [iosOpen,     setIosOpen]     = useState(false)
  const [desktopOpen, setDesktopOpen] = useState(false)

  if (installed || isStandalone()) return null

  async function handleClick() {
    if (canInstall) {
      const outcome = await triggerInstall()
      if (outcome === 'accepted') {
        toast('安装成功！可以在桌面/主屏幕找到 NCC', 'success')
      }
      return
    }
    if (isIos()) {
      setIosOpen(true)
      return
    }
    setDesktopOpen(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full bg-gradient-to-br from-primary-50 to-white rounded-2xl border border-primary-100
                   shadow-sm p-4 flex items-center gap-3 hover:from-primary-100 transition-all
                   active:scale-[0.99]"
      >
        <div className="w-11 h-11 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0
                        shadow-sm shadow-primary-200">
          <Download size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold text-gray-900">安装到桌面</p>
          <p className="text-xs text-gray-500 mt-0.5">添加为 App，打开更快、收消息更及时</p>
        </div>
        <Smartphone size={16} className="text-primary-400 flex-shrink-0" />
      </button>

      {/* iOS Safari instructions */}
      {iosOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-end lg:items-center justify-center"
          onClick={() => setIosOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl lg:rounded-3xl w-full lg:max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">在 iPhone 上安装</h3>
              <button onClick={() => setIosOpen(false)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 font-bold text-xs flex items-center justify-center">1</span>
                <span>
                  点击 Safari 底部的
                  <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">
                    <Share size={12} /> 分享
                  </span>
                  按钮
                </span>
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
            <button
              onClick={() => setIosOpen(false)}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* Generic instructions for desktop / other browsers */}
      {desktopOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-end lg:items-center justify-center"
          onClick={() => setDesktopOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">安装到桌面</h3>
              <button onClick={() => setDesktopOpen(false)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Monitor size={16} className="text-blue-600" />
                <p className="text-sm font-bold text-blue-900">电脑 (Chrome / Edge)</p>
              </div>
              <ol className="space-y-1.5 text-sm text-gray-700 ml-1">
                <li>1. 点击地址栏右侧的 <strong>安装</strong> 图标 <span className="inline-block text-blue-600">⊕</span></li>
                <li>2. 在弹窗中点「安装」</li>
                <li>3. App 会自动添加到桌面 / 开始菜单</li>
              </ol>
            </div>

            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone size={16} className="text-green-600" />
                <p className="text-sm font-bold text-green-900">安卓 (Chrome)</p>
              </div>
              <ol className="space-y-1.5 text-sm text-gray-700 ml-1">
                <li>1. 点击浏览器右上角 <strong>⋮</strong> 菜单</li>
                <li>2. 选择「<strong>添加到主屏幕</strong>」或「<strong>安装应用</strong>」</li>
                <li>3. 确认即可</li>
              </ol>
            </div>

            <p className="text-xs text-gray-400">
              如果没有看到「安装」选项，可能浏览器还在准备中，请刷新页面或稍后再试。
            </p>

            <button
              onClick={() => setDesktopOpen(false)}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  )
}
