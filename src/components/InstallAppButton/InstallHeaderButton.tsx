// ─── InstallHeaderButton ──────────────────────────────────────────────────────
// 顶栏常驻「下载到桌面」入口(长期显示,已安装/独立窗口时隐藏)。
//   • 有 beforeinstallprompt → 直接触发原生安装
//   • iOS Safari / 其它浏览器 → 弹出简明安装说明
// 手机端只显示图标,桌面端显示「下载」文字,节省顶栏空间。
import { useState } from 'react'
import { Download, Share, X, Monitor, Smartphone } from 'lucide-react'
import { isIos, isStandalone, triggerInstall, useInstallState } from '../../lib/pwa'
import { toast } from '../../lib/toast'

export default function InstallHeaderButton() {
  const { canInstall, installed } = useInstallState()
  const [guide, setGuide] = useState<null | 'ios' | 'other'>(null)

  if (installed || isStandalone()) return null

  async function handleClick() {
    if (canInstall) {
      const outcome = await triggerInstall()
      if (outcome === 'accepted') toast('安装成功！可在桌面/主屏幕找到 华邻', 'success')
      return
    }
    setGuide(isIos() ? 'ios' : 'other')
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1 text-xs md:text-sm font-medium text-primary-700
                   bg-primary-50 border border-primary-100 px-2 md:px-2.5 py-2 rounded-lg
                   hover:bg-primary-100 transition-colors flex-shrink-0"
        aria-label="下载到桌面"
      >
        <Download size={16} />
        <span className="hidden md:inline">下载到桌面</span>
      </button>

      {guide && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end lg:items-center justify-center"
          onClick={() => setGuide(null)}>
          <div className="bg-white rounded-t-3xl lg:rounded-3xl w-full lg:max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">下载到桌面 / 主屏幕</h3>
              <button onClick={() => setGuide(null)} className="text-gray-400"><X size={18} /></button>
            </div>

            {guide === 'ios' ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 font-bold text-xs flex items-center justify-center">1</span>
                  <span>点击 Safari 底部的
                    <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold"><Share size={12} /> 分享</span>
                    按钮</span>
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
            ) : (
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2"><Monitor size={16} className="text-blue-600" /><p className="text-sm font-bold text-blue-900">电脑 (Chrome / Edge)</p></div>
                  <ol className="space-y-1.5 text-sm text-gray-700 ml-1">
                    <li>1. 点击地址栏右侧的 <strong>安装</strong> 图标 ⊕</li>
                    <li>2. 弹窗中点「安装」，App 自动加到桌面</li>
                  </ol>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2"><Smartphone size={16} className="text-green-600" /><p className="text-sm font-bold text-green-900">安卓 (Chrome)</p></div>
                  <ol className="space-y-1.5 text-sm text-gray-700 ml-1">
                    <li>1. 右上角 <strong>⋮</strong> 菜单</li>
                    <li>2. 选「<strong>添加到主屏幕</strong>」或「<strong>安装应用</strong>」</li>
                  </ol>
                </div>
              </div>
            )}

            <button onClick={() => setGuide(null)}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors">
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  )
}
