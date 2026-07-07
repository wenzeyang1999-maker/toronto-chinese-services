// ─── Admin · Membership management tab ───────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Crown, X, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { type MemberRow } from '../types'
import { useAdminContext } from '../AdminContext'
import { attachEmails } from '../adminEmails'

export default function MembershipTab() {
  const { acting, setActing, showNotice, runAdminAction, setDeleteTarget } = useAdminContext()
  const [memberSearch,  setMemberSearch]  = useState('')
  const [memberResults, setMemberResults] = useState<MemberRow[]>([])

  async function searchMembers() {
    const kw = memberSearch.trim()
    const query = supabase
      .from('users')
      .select('id, name, membership_level, membership_expires_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (kw) query.ilike('name', `%${kw}%`)
    const { data, error } = await query
    if (error) {
      showNotice('error', `搜索会员失败：${error.message}`)
      return
    }
    setMemberResults(await attachEmails((data ?? []) as Omit<MemberRow, 'email'>[]) as MemberRow[])
  }

  async function grantMembership(row: MemberRow, level: 'L2' | 'L3') {
    setActing(row.id)
    const now = new Date()
    const current = row.membership_expires_at ? new Date(row.membership_expires_at) : null
    const base = current && current > now ? current : now
    const newExpiry = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_membership', {
        target_user_id: row.id,
        new_level: level,
        new_expires_at: newExpiry,
      })
      if (error) throw error
    }, `已授予 ${level} 会员 30 天`)
    if (ok !== null) {
      setMemberResults(prev => prev.map(r =>
        r.id === row.id ? { ...r, membership_level: level, membership_expires_at: newExpiry } : r
      ))
    }
    setActing(null)
  }

  async function revokeMembership(row: MemberRow) {
    setActing(row.id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_membership', {
        target_user_id: row.id,
        new_level: 'L1',
        new_expires_at: null,
      })
      if (error) throw error
    }, '已撤销会员')
    if (ok !== null) {
      setMemberResults(prev => prev.map(r =>
        r.id === row.id ? { ...r, membership_level: 'L1', membership_expires_at: null } : r
      ))
    }
    setActing(null)
  }

  useEffect(() => {
    void searchMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-2">
        <input
          value={memberSearch}
          onChange={e => setMemberSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchMembers()}
          placeholder="搜索用户姓名或邮箱"
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
        />
        <button onClick={searchMembers}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-1.5">
          <Search size={14} /> 搜索
        </button>
      </div>

      {memberResults.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
          搜索用户后在此显示
        </div>
      ) : (
        <div className="space-y-2">
          {memberResults.map(row => {
            const now = new Date()
            const expiry = row.membership_expires_at ? new Date(row.membership_expires_at) : null
            const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86400000)) : null
            const isActive = !!(expiry && expiry > now)
            const effectiveLevel = isActive ? row.membership_level : 'L1'
            return (
              <div key={row.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                    <p className="text-xs text-gray-400 truncate">{row.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${
                      effectiveLevel === 'L3' ? 'bg-zinc-900 text-amber-400' :
                      effectiveLevel === 'L2' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{effectiveLevel}</span>
                    {daysLeft !== null && isActive && (
                      <p className="text-xs text-gray-400 mt-1">剩余 {daysLeft} 天</p>
                    )}
                    {expiry && !isActive && (
                      <p className="text-xs text-red-400 mt-1">已到期</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { if (confirm(`授予 ${row.name} 黄金会员 (L2) 30 天？`)) grantMembership(row, 'L2') }}
                    disabled={acting === row.id}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors font-semibold disabled:opacity-50">
                    <Crown size={11} /> 授予L2 +30天
                  </button>
                  <button
                    onClick={() => { if (confirm(`授予 ${row.name} 至尊会员 (L3) 30 天？`)) grantMembership(row, 'L3') }}
                    disabled={acting === row.id}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-900 text-amber-400 hover:bg-zinc-700 transition-colors font-semibold disabled:opacity-50">
                    <Crown size={11} /> 授予L3 +30天
                  </button>
                  {effectiveLevel !== 'L1' && (
                    <button
                      onClick={() => { if (confirm(`撤销 ${row.name} 的会员资格？`)) revokeMembership(row) }}
                      disabled={acting === row.id}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50">
                      <X size={11} /> 撤销会员
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget({
                      id: row.id, name: row.name, email: row.email,
                      onDeleted: () => setMemberResults(prev => prev.filter(r => r.id !== row.id)),
                    })}
                    disabled={acting === row.id}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 ml-auto">
                    <Trash2 size={11} /> 删除账号
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
