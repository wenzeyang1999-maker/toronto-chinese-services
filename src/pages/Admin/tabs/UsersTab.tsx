// ─── Admin · User management tab ─────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, BadgeCheck, CheckCircle2, Ban, UserCheck, ExternalLink, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type UserRow } from '../types'
import { useAdminContext } from '../AdminContext'
import { attachEmails } from '../adminEmails'

export default function UsersTab() {
  const { acting, setActing, showNotice, runAdminAction } = useAdminContext()
  const [userSearch,  setUserSearch]  = useState('')
  const [userResults, setUserResults] = useState<UserRow[]>([])

  async function searchUsers() {
    const kw = userSearch.trim()
    const query = supabase
      .from('users')
      .select('id, name, role, created_at, is_email_verified, business_verified, referral_code')
      .order('created_at', { ascending: false })
      .limit(30)
    if (kw) query.or(`name.ilike.%${kw}%,referral_code.ilike.%${kw}%`)
    const { data, error } = await query
    if (error) {
      showNotice('error', `搜索用户失败：${error.message}`)
      return
    }
    setUserResults(await attachEmails((data ?? []) as Omit<UserRow, 'email'>[]) as UserRow[])
  }

  async function setUserRole(userId: string, role: UserRow['role']) {
    setActing(userId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_user_role', {
        target_user_id: userId,
        new_role: role,
      })
      if (error) throw error
    }, role === 'banned' ? '账号已封禁' : role === 'provider' ? '已设为服务商' : '角色已更新')
    if (ok !== null) {
      setUserResults(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    }
    setActing(null)
  }

  async function promoteToVerifiedProvider(userId: string) {
    setActing(userId)
    const ok = await runAdminAction(async () => {
      const { error: roleErr } = await supabase.rpc('admin_set_user_role', {
        target_user_id: userId,
        new_role: 'provider',
      })
      if (roleErr) throw roleErr
      const { error: verifyErr } = await supabase.rpc('admin_review_verification', {
        target_user_id: userId,
        approved: true,
      })
      if (verifyErr) throw verifyErr
    }, '已设为认证服务商')
    if (ok !== null) {
      setUserResults(prev => prev.map(u =>
        u.id === userId ? { ...u, role: 'provider', business_verified: true } : u
      ))
    }
    setActing(null)
  }

  useEffect(() => {
    void searchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">

      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-2">
        <input
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchUsers()}
          placeholder="搜索姓名或邮箱，留空查看最新30条"
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
        />
        <button onClick={searchUsers}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-1.5">
          <Search size={14} /> 搜索
        </button>
      </div>

      {userResults.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
          搜索用户后在此显示
        </div>
      ) : (
        <div className="space-y-2">
          {userResults.map(u => {
            const isBanned   = u.role === 'banned'
            const isAdmin    = u.role === 'admin'
            const isProvider = u.role === 'provider'
            return (
              <div key={u.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${isBanned ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                <div className="flex items-start gap-3">

                  {/* Avatar placeholder */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 text-sm ${
                    isBanned ? 'bg-red-400' : isAdmin ? 'bg-purple-500' : 'bg-primary-500'
                  }`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{u.name}</span>
                      {/* Role badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isBanned   ? 'bg-red-100 text-red-600' :
                        isAdmin    ? 'bg-purple-100 text-purple-700' :
                        isProvider ? 'bg-blue-100 text-blue-700' :
                                     'bg-gray-100 text-gray-500'
                      }`}>
                        {isBanned ? '已封号' : isAdmin ? '管理员' : isProvider ? '服务商' : '用户'}
                      </span>
                      {u.business_verified && (
                        <span className="text-xs text-blue-600 flex items-center gap-0.5 font-semibold">
                          <BadgeCheck size={13} /> 已认证
                        </span>
                      )}
                      {u.is_email_verified && (
                        <span className="text-xs text-green-600 flex items-center gap-0.5">
                          <CheckCircle2 size={11} /> 已验证
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{u.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      注册于 {u.created_at.slice(0, 10)}
                      {u.referral_code && <span className="ml-2 text-gray-300">码: {u.referral_code}</span>}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {!isAdmin && (
                  <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100">
                    {isBanned ? (
                      <button
                        onClick={() => setUserRole(u.id, 'user')}
                        disabled={acting === u.id}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-semibold transition-colors disabled:opacity-50"
                      >
                        <UserCheck size={12} /> 解封账号
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (!confirm(`确定封号 ${u.name}？封号后该用户无法登录。`)) return
                          setUserRole(u.id, 'banned')
                        }}
                        disabled={acting === u.id}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors disabled:opacity-50"
                      >
                        <Ban size={12} /> 封号
                      </button>
                    )}
                    {!isProvider && !isBanned && (
                      <button
                        onClick={() => {
                          if (!confirm(`设 ${u.name} 为认证服务商？`)) return
                          promoteToVerifiedProvider(u.id)
                        }}
                        disabled={acting === u.id}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors disabled:opacity-50"
                      >
                        <BadgeCheck size={12} /> 设为认证服务商
                      </button>
                    )}
                    {isProvider && (
                      <button
                        onClick={async () => {
                          if (!confirm(`撤销 ${u.name} 的服务商资格？`)) return
                          await setUserRole(u.id, 'user')
                          if (u.business_verified) {
                            await supabase.rpc('admin_review_verification', {
                              target_user_id: u.id,
                              approved: false,
                            })
                            setUserResults(prev => prev.map(r =>
                              r.id === u.id ? { ...r, business_verified: false } : r
                            ))
                          }
                        }}
                        disabled={acting === u.id}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <X size={12} /> 撤销服务商
                      </button>
                    )}
                    <a
                      href={`/provider/${u.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink size={12} /> 查看主页
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
