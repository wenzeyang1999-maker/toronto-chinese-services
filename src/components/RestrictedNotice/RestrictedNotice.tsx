// 受限地区提示(中国大陆等):可浏览,但不开放注册/发布。
import { Link } from 'react-router-dom'

export default function RestrictedNotice({ action = '此功能' }: { action?: string }) {
  return (
    <div className="max-w-sm mx-auto text-center px-6 py-10">
      <div className="text-4xl mb-3">🍁</div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">华邻目前仅面向加拿大地区提供服务</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-6">
        {action}暂不对你当前所在地区开放。你仍可自由浏览平台上的服务、房源、二手与社区内容。
      </p>
      <Link to="/" className="inline-block px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
        返回浏览
      </Link>
    </div>
  )
}
