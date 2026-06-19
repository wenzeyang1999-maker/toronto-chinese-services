// ─── Admin Page ────────────────────────────────────────────────────────────────
// Route: /admin  — only accessible by users with role='admin' in users table.
// Each tab is a self-contained component under ./tabs that owns its own data and
// loads on mount; cross-cutting helpers are shared via <AdminContext.Provider>.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ChevronLeft, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import AdminNotificationsBell from '../../components/AdminNotifications/AdminNotificationsBell'
import { type Stats, type AdminNotice, type DeleteTarget } from './types'
import AdminContext, { type AdminCtx } from './AdminContext'
import OverviewTab from './tabs/OverviewTab'
import PromotedTab from './tabs/PromotedTab'
import PromoRequestsTab from './tabs/PromoRequestsTab'
import ReportsTab from './tabs/ReportsTab'
import UserReportsTab from './tabs/UserReportsTab'
import CommunityReportsTab from './tabs/CommunityReportsTab'
import VerificationTab from './tabs/VerificationTab'
import MembershipTab from './tabs/MembershipTab'
import UsersTab from './tabs/UsersTab'
import ServicesTab from './tabs/ServicesTab'
import CommunityTab from './tabs/CommunityTab'
import InquiriesTab from './tabs/InquiriesTab'
import LogsTab from './tabs/LogsTab'

type Tab =
  | 'reports' | 'userReports' | 'communityReports' | 'verification' | 'promoted'
  | 'promoRequests' | 'overview' | 'community' | 'membership' | 'inquiries'
  | 'users' | 'services' | 'logs'

export default function AdminPage() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [allowed,       setAllowed]       = useState<boolean | null>(null)
  const [stats,         setStats]         = useState<Stats | null>(null)
  const [tab,           setTab]           = useState<Tab>('reports')
  const [loading,       setLoading]       = useState(true)
  const [acting,        setActing]        = useState<string | null>(null)
  const [notice,        setNotice]        = useState<AdminNotice | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<DeleteTarget | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError,   setDeleteError]   = useState('')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    supabase.from('users').select('role').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.role !== 'admin') { navigate('/'); return }
        setAllowed(true)
        loadAll()
      })
  }, [user, navigate])

  async function loadAll() {
    setLoading(true)
    await loadStats()
    setLoading(false)
  }

  async function loadStats() {
    const [users, services, jobs, properties, secondhand, events, reports, contentReportsCount, verifs] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }),
      supabase.from('jobs').select('id', { count: 'exact', head: true }),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('secondhand').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('review_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    ])
    setStats({
      users:                  users.count ?? 0,
      services:               services.count ?? 0,
      jobs:                   jobs.count ?? 0,
      properties:             properties.count ?? 0,
      secondhand:             secondhand.count ?? 0,
      events:                 events.count ?? 0,
      pending_reports:        reports.count ?? 0,
      pending_content_reports: contentReportsCount.count ?? 0,
      pending_verifications:  verifs.count ?? 0,
    })
  }

  function showNotice(type: AdminNotice['type'], text: string) {
    setNotice({ type, text })
    window.clearTimeout((showNotice as typeof showNotice & { timer?: number }).timer)
    ;(showNotice as typeof showNotice & { timer?: number }).timer = window.setTimeout(() => {
      setNotice(null)
    }, 3000)
  }

  async function runAdminAction<T>(action: () => Promise<T>, successText: string): Promise<T | null> {
    setNotice(null)
    try {
      const result = await action()
      showNotice('success', successText)
      return result
    } catch (err) {
      showNotice('error', err instanceof Error ? err.message : '操作失败，请稍后再试')
      return null
    }
  }

  // Opening the delete modal always clears any stale confirm input / error.
  function openDeleteTarget(t: DeleteTarget | null) {
    setDeleteTarget(t)
    setDeleteConfirm('')
    setDeleteError('')
  }

  async function deleteUser(userId: string, name: string) {
    // 防误删确认：要求管理员手动输入目标用户名（不在代码里写死任何口令；
    // 真正的权限闸门在 admin_delete_user RPC 的 role='admin' 服务端校验）。
    if (deleteConfirm.trim() !== name.trim()) {
      setDeleteError('用户名不匹配')
      return
    }
    setActing(userId)
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId })
    setActing(null)
    if (error) {
      setDeleteError('删除失败：' + error.message)
      return
    }
    deleteTarget?.onDeleted?.()   // let the opening tab refresh its own list
    setDeleteTarget(null)
    setDeleteConfirm('')
    setDeleteError('')
    setNotice({ type: 'success', text: `已彻底删除用户 ${name}` })
  }

  if (allowed === null) return null

  const adminCtx: AdminCtx = {
    acting,
    setActing,
    showNotice,
    runAdminAction,
    refreshStats: loadStats,
    setDeleteTarget: openDeleteTarget,
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'reports',          label: `举报${stats ? ` (${stats.pending_reports})` : ''}` },
    { key: 'userReports',      label: '用户投诉' },
    { key: 'communityReports', label: `内容举报${stats ? ` (${stats.pending_content_reports})` : ''}` },
    { key: 'verification',     label: `认证审核${stats ? ` (${stats.pending_verifications})` : ''}` },
    { key: 'promoted',         label: '置顶推广' },
    { key: 'promoRequests',    label: '置顶申请' },
    { key: 'community',        label: '社区帖子' },
    { key: 'inquiries',        label: '询价' },
    { key: 'overview',         label: '数据概览' },
    { key: 'membership',       label: '会员管理' },
    { key: 'users',            label: '用户管理' },
    { key: 'services',         label: '服务审核' },
    { key: 'logs',             label: '操作日志' },
  ]

  return (
    <AdminContext.Provider value={adminCtx}>
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <ShieldCheck size={20} className="text-primary-600" />
        <span className="font-semibold text-gray-800 flex-1">管理后台</span>
        <AdminNotificationsBell compact />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {notice && (
          <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {notice.text}
          </div>
        )}

        {/* Tabs — horizontally scrollable */}
        <div className="overflow-x-auto -mx-4 px-4 pb-0.5">
          <div className="flex gap-1.5 min-w-max">
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`whitespace-nowrap px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  tab === key ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">加载中…</div>
        ) : tab === 'overview' ? (
          stats ? <OverviewTab stats={stats} /> : null
        ) : tab === 'promoted' ? (
          <PromotedTab />
        ) : tab === 'promoRequests' ? (
          <PromoRequestsTab />
        ) : tab === 'userReports' ? (
          <UserReportsTab />
        ) : tab === 'communityReports' ? (
          <CommunityReportsTab />
        ) : tab === 'community' ? (
          <CommunityTab />
        ) : tab === 'verification' ? (
          <VerificationTab />
        ) : tab === 'reports' ? (
          <ReportsTab />
        ) : tab === 'membership' ? (
          <MembershipTab />
        ) : tab === 'inquiries' ? (
          <InquiriesTab />
        ) : tab === 'users' ? (
          <UsersTab />
        ) : tab === 'services' ? (
          <ServicesTab />
        ) : tab === 'logs' ? (
          <LogsTab />
        ) : null}
      </div>

      {/* Delete user confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900">确认删除账号</h3>
            <p className="text-sm text-gray-500">
              将彻底删除 <span className="font-semibold text-gray-800">{deleteTarget.name}</span>（{deleteTarget.email}）的所有数据，且无法恢复。
            </p>
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-medium">passcode：</label>
              <input
                type="password"
                autoComplete="off"
                value={deleteConfirm}
                onChange={e => { setDeleteConfirm(e.target.value); setDeleteError('') }}
                onKeyDown={e => e.key === 'Enter' && deleteUser(deleteTarget.id, deleteTarget.name)}
                placeholder=""
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-300"
              />
              {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); setDeleteError('') }}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button
                onClick={() => deleteUser(deleteTarget.id, deleteTarget.name)}
                disabled={acting === deleteTarget.id}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                <Trash2 size={14} /> 确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminContext.Provider>
  )
}
