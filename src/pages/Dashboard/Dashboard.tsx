// ─── 独立数据后台(老板专用)──────────────────────────────────────────────────
// Route: /dashboard — 与主 App 分开的极简后台页。仅 role in ('admin','boss') 可进,
// 其他人(未登录/普通用户)一律弹走。只展示数据后台,看不到运营 tab。
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, BarChart3 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import BackendTab from '../Admin/tabs/BackendTab'

export default function Dashboard() {
  const navigate = useNavigate()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // 用 getUser()(权威、等 session 恢复)判断,避免直接打开时误判未登录。
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!authUser) { navigate('/login', { state: { from: '/dashboard' } }); return }
      const { data } = await supabase.from('users').select('role').eq('id', authUser.id).single()
      if (cancelled) return
      if (data?.role !== 'admin' && data?.role !== 'boss') { navigate('/'); return }  // 无权限 → 回首页
      setAllowed(true)
    })()
    return () => { cancelled = true }
  }, [navigate])

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (allowed !== true) {
    return <div className="min-h-[100dvh] flex items-center justify-center text-gray-400 text-sm">加载中…</div>
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* 极简顶栏 —— 无主 App 导航,只有标题 + 登出 */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 pt-safe">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <BarChart3 size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">华邻 · 数据后台</p>
              <p className="text-[11px] text-gray-400 mt-0.5">仅数据查看</p>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-100">
            <LogOut size={13} /> 退出
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5">
        <BackendTab />
      </main>
    </div>
  )
}
