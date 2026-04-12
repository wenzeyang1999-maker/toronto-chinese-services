// ─── Admin Page ────────────────────────────────────────────────────────────────
// Route: /admin  — only accessible by users with role='admin' in users table
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Flag, CheckCircle2, Trash2, ChevronLeft, Users, Briefcase, Home, ShoppingBag, Calendar, Wrench, Star, BadgeCheck, X, ExternalLink, Zap, Crown, Search, Inbox, Mail, CheckCheck, Ban, UserCheck, UserCog } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

interface ReportRow {
  id: string
  reason: string
  status: string
  created_at: string
  review: {
    id: string
    rating: number
    comment: string | null
    service: { id: string; title: string } | null
  } | null
  reporter: { id: string; name: string } | null
}

interface Stats {
  users: number
  services: number
  jobs: number
  properties: number
  secondhand: number
  events: number
  pending_reports: number
  pending_verifications: number
}

interface VerificationRow {
  id: string
  name: string
  email: string
  verification_doc_url: string | null
  verification_status: string
  created_at: string
}

interface PromotedRow {
  id: string
  title: string
  table: 'services' | 'jobs' | 'properties' | 'secondhand' | 'events'
  is_promoted: boolean
  created_at: string
}

interface InquiryMatch {
  id: string
  provider_name: string
  provider_email: string
  email_sent: boolean
}

interface InquiryRow {
  id: string
  category_id: string
  description: string
  budget: string | null
  timing: string
  name: string
  phone: string
  wechat: string | null
  status: string
  created_at: string
  matches: InquiryMatch[]
}

interface MemberRow {
  id: string
  name: string
  email: string
  membership_level: 'L1' | 'L2' | 'L3'
  membership_expires_at: string | null
}

interface NewServiceRow {
  id: string
  title: string
  description: string
  category_id: string
  is_available: boolean
  is_promoted: boolean
  created_at: string
  provider: { id: string; name: string; email: string } | null
}

interface UserRow {
  id: string
  name: string
  email: string
  role: 'user' | 'provider' | 'admin' | 'banned'
  created_at: string
  is_email_verified: boolean
  referral_code: string | null
}

const REASON_LABEL: Record<string, string> = {
  irrelevant: '内容无关',
  malicious:  '恶意攻击',
  fake:       '虚假评价',
  spam:       '垃圾广告',
  other:      '其他',
}

export default function AdminPage() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [allowed,        setAllowed]        = useState<boolean | null>(null)
  const [reports,        setReports]        = useState<ReportRow[]>([])
  const [verifications,  setVerifications]  = useState<VerificationRow[]>([])
  const [promoted,       setPromoted]       = useState<PromotedRow[]>([])
  const [promoSearch,    setPromoSearch]    = useState('')
  const [promoTable,     setPromoTable]     = useState<PromotedRow['table']>('services')
  const [stats,          setStats]          = useState<Stats | null>(null)
  const [tab,            setTab]            = useState<'reports' | 'verification' | 'promoted' | 'overview' | 'community' | 'membership' | 'inquiries' | 'users' | 'services'>('reports')
  const [inquiries,      setInquiries]      = useState<InquiryRow[]>([])
  const [communityPosts, setCommunityPosts] = useState<{ id: string; title: string; type: string; area: string; created_at: string; author: { name: string } | null }[]>([])
  const [loading,        setLoading]        = useState(true)
  const [acting,         setActing]         = useState<string | null>(null)
  const [memberSearch,   setMemberSearch]   = useState('')
  const [memberResults,  setMemberResults]  = useState<MemberRow[]>([])
  const [userSearch,     setUserSearch]     = useState('')
  const [userResults,    setUserResults]    = useState<UserRow[]>([])
  const [newServices,    setNewServices]    = useState<NewServiceRow[]>([])
  const [selectedSvcs,   setSelectedSvcs]  = useState<Set<string>>(new Set())

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
    await Promise.all([loadReports(), loadVerifications(), loadStats()])
    setLoading(false)
  }

  async function searchPromoted() {
    const kw = promoSearch.trim()
    const query = supabase
      .from(promoTable)
      .select('id, title, is_promoted, created_at')
      .order('is_promoted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)
    if (kw) query.ilike('title', `%${kw}%`)
    const { data } = await query
    setPromoted((data ?? []).map((r: any) => ({ ...r, table: promoTable })))
  }

  async function togglePromoted(row: PromotedRow) {
    setActing(row.id)
    await supabase.from(row.table).update({ is_promoted: !row.is_promoted }).eq('id', row.id)
    setPromoted(prev => prev.map(r => r.id === row.id ? { ...r, is_promoted: !r.is_promoted } : r))
    setActing(null)
  }

  async function loadVerifications() {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, verification_doc_url, verification_status, created_at')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: false })
    if (data) setVerifications(data as VerificationRow[])
  }

  async function loadReports() {
    const { data } = await supabase
      .from('review_reports')
      .select(`
        id, reason, status, created_at,
        review:review_id(id, rating, comment, service:service_id(id, title)),
        reporter:reporter_id(id, name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (data) {
      setReports(data.map((r: any) => ({
        ...r,
        review:   Array.isArray(r.review)   ? r.review[0]   : r.review,
        reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
      })))
    }
  }

  async function loadStats() {
    const [users, services, jobs, properties, secondhand, events, reports, verifs] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }),
      supabase.from('jobs').select('id', { count: 'exact', head: true }),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('secondhand').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('review_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    ])
    setStats({
      users:                 users.count ?? 0,
      services:              services.count ?? 0,
      jobs:                  jobs.count ?? 0,
      properties:            properties.count ?? 0,
      secondhand:            secondhand.count ?? 0,
      events:                events.count ?? 0,
      pending_reports:       reports.count ?? 0,
      pending_verifications: verifs.count ?? 0,
    })
  }

  async function dismiss(reportId: string) {
    setActing(reportId)
    await supabase.from('review_reports').update({ status: 'dismissed' }).eq('id', reportId)
    setReports(prev => prev.filter(r => r.id !== reportId))
    setActing(null)
  }

  async function approveVerification(userId: string) {
    setActing(userId)
    await supabase.from('users').update({
      verification_status: 'approved',
      business_verified: true,
    }).eq('id', userId)
    setVerifications(prev => prev.filter(v => v.id !== userId))
    setActing(null)
  }

  async function rejectVerification(userId: string) {
    setActing(userId)
    await supabase.from('users').update({
      verification_status: 'rejected',
    }).eq('id', userId)
    setVerifications(prev => prev.filter(v => v.id !== userId))
    setActing(null)
  }

  async function loadCommunityPosts() {
    const { data } = await supabase
      .from('community_posts')
      .select('id, title, type, area, created_at, author:author_id(name)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setCommunityPosts(data.map((p: any) => ({ ...p, author: Array.isArray(p.author) ? p.author[0] : p.author })))
  }

  async function deleteCommunityPost(postId: string) {
    setActing(postId)
    await supabase.from('community_posts').delete().eq('id', postId)
    setCommunityPosts(prev => prev.filter(p => p.id !== postId))
    setActing(null)
  }

  async function loadInquiries() {
    const { data } = await supabase
      .from('inquiries')
      .select('id, category_id, description, budget, timing, name, phone, wechat, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!data) return

    const ids = data.map((r: any) => r.id)
    const { data: matches } = await supabase
      .from('inquiry_matches')
      .select('id, inquiry_id, provider_name, provider_email, email_sent')
      .in('inquiry_id', ids)

    const matchMap: Record<string, InquiryMatch[]> = {}
    for (const m of matches ?? []) {
      if (!matchMap[m.inquiry_id]) matchMap[m.inquiry_id] = []
      matchMap[m.inquiry_id].push(m)
    }
    setInquiries(data.map((r: any) => ({ ...r, matches: matchMap[r.id] ?? [] })))
  }

  async function searchMembers() {
    const kw = memberSearch.trim()
    if (!kw) return
    const { data } = await supabase
      .from('users')
      .select('id, name, email, membership_level, membership_expires_at')
      .or(`name.ilike.%${kw}%,email.ilike.%${kw}%`)
      .limit(20)
    setMemberResults((data ?? []) as MemberRow[])
  }

  async function grantMembership(row: MemberRow, level: 'L2' | 'L3') {
    setActing(row.id)
    const now = new Date()
    const current = row.membership_expires_at ? new Date(row.membership_expires_at) : null
    const base = current && current > now ? current : now
    const newExpiry = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('users').update({
      membership_level: level,
      membership_expires_at: newExpiry,
    }).eq('id', row.id)
    setMemberResults(prev => prev.map(r =>
      r.id === row.id ? { ...r, membership_level: level, membership_expires_at: newExpiry } : r
    ))
    setActing(null)
  }

  async function revokeMembership(row: MemberRow) {
    setActing(row.id)
    await supabase.from('users').update({
      membership_level: 'L1',
      membership_expires_at: null,
    }).eq('id', row.id)
    setMemberResults(prev => prev.map(r =>
      r.id === row.id ? { ...r, membership_level: 'L1', membership_expires_at: null } : r
    ))
    setActing(null)
  }

  async function loadNewServices() {
    const { data } = await supabase
      .from('services')
      .select('id, title, description, category_id, is_available, is_promoted, created_at, provider:provider_id(id, name, email)')
      .order('created_at', { ascending: false })
      .limit(60)
    if (data) setNewServices(data.map((r: any) => ({
      ...r,
      provider: Array.isArray(r.provider) ? r.provider[0] : r.provider,
    })))
  }

  async function takedownService(id: string) {
    setActing(id)
    await supabase.from('services').update({ is_available: false }).eq('id', id)
    setNewServices(prev => prev.map(s => s.id === id ? { ...s, is_available: false } : s))
    setSelectedSvcs(prev => { const n = new Set(prev); n.delete(id); return n })
    setActing(null)
  }

  async function restoreService(id: string) {
    setActing(id)
    await supabase.from('services').update({ is_available: true }).eq('id', id)
    setNewServices(prev => prev.map(s => s.id === id ? { ...s, is_available: true } : s))
    setActing(null)
  }

  async function bulkTakedown() {
    if (selectedSvcs.size === 0) return
    if (!confirm(`确定下架选中的 ${selectedSvcs.size} 条服务？`)) return
    const ids = Array.from(selectedSvcs)
    await supabase.from('services').update({ is_available: false }).in('id', ids)
    setNewServices(prev => prev.map(s => ids.includes(s.id) ? { ...s, is_available: false } : s))
    setSelectedSvcs(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedSvcs(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    const available = newServices.filter(s => s.is_available).map(s => s.id)
    if (selectedSvcs.size === available.length) {
      setSelectedSvcs(new Set())
    } else {
      setSelectedSvcs(new Set(available))
    }
  }

  async function searchUsers() {
    const kw = userSearch.trim()
    const query = supabase
      .from('users')
      .select('id, name, email, role, created_at, is_email_verified, referral_code')
      .order('created_at', { ascending: false })
      .limit(30)
    if (kw) query.or(`name.ilike.%${kw}%,email.ilike.%${kw}%`)
    const { data } = await query
    setUserResults((data ?? []) as UserRow[])
  }

  async function setUserRole(userId: string, role: UserRow['role']) {
    setActing(userId)
    await supabase.from('users').update({ role }).eq('id', userId)
    setUserResults(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    setActing(null)
  }

  async function removeReview(report: ReportRow) {
    if (!report.review) return
    setActing(report.id)
    await supabase.from('reviews').delete().eq('id', report.review.id)
    await supabase.from('review_reports').update({ status: 'removed' }).eq('review_id', report.review.id)
    setReports(prev => prev.filter(r => r.review?.id !== report.review?.id))
    setActing(null)
  }

  if (allowed === null) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <ShieldCheck size={20} className="text-primary-600" />
        <span className="font-semibold text-gray-800 flex-1">管理后台</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
          <button onClick={() => setTab('reports')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'reports' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            举报 {stats ? `(${stats.pending_reports})` : ''}
          </button>
          <button onClick={() => setTab('verification')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'verification' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            认证审核 {stats ? `(${stats.pending_verifications})` : ''}
          </button>
          <button onClick={() => { setTab('promoted'); searchPromoted() }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'promoted' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            置顶推广
          </button>
          <button onClick={() => { setTab('community'); loadCommunityPosts() }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'community' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            社区帖子
          </button>
          <button onClick={() => { setTab('inquiries'); loadInquiries() }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'inquiries' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            询价
          </button>
          <button onClick={() => setTab('overview')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'overview' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            数据概览
          </button>
          <button onClick={() => setTab('membership')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'membership' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            会员管理
          </button>
          <button onClick={() => { setTab('users'); searchUsers() }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'users' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            用户管理
          </button>
          <button onClick={() => { setTab('services'); loadNewServices() }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'services' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            服务审核
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">加载中…</div>
        ) : tab === 'overview' && stats ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: <Users size={20} />,       label: '注册用户',   value: stats.users,           color: 'text-blue-600 bg-blue-50' },
              { icon: <Wrench size={20} />,       label: '服务',       value: stats.services,        color: 'text-primary-600 bg-primary-50' },
              { icon: <Briefcase size={20} />,    label: '招聘职位',   value: stats.jobs,            color: 'text-purple-600 bg-purple-50' },
              { icon: <Home size={20} />,         label: '房源',       value: stats.properties,      color: 'text-green-600 bg-green-50' },
              { icon: <ShoppingBag size={20} />,  label: '闲置',       value: stats.secondhand,      color: 'text-orange-600 bg-orange-50' },
              { icon: <Calendar size={20} />,     label: '活动',       value: stats.events,          color: 'text-pink-600 bg-pink-50' },
              { icon: <Flag size={20} />,         label: '待处理举报', value: stats.pending_reports, color: 'text-red-600 bg-red-50' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                  {icon}
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        ) : tab === 'promoted' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Table selector + search */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              {/* Table tabs */}
              <div className="flex gap-1 flex-wrap">
                {(['services','jobs','properties','secondhand','events'] as const).map(t => (
                  <button key={t} onClick={() => setPromoTable(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      promoTable === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {{ services:'服务', jobs:'招聘', properties:'房源', secondhand:'闲置', events:'活动' }[t]}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="flex gap-2">
                <input
                  value={promoSearch} onChange={e => setPromoSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchPromoted()}
                  placeholder="搜索帖子标题（留空显示全部）"
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
                />
                <button onClick={searchPromoted}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors">
                  搜索
                </button>
              </div>
            </div>

            {/* Results */}
            {promoted.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
                点击搜索查看帖子
              </div>
            ) : (
              <div className="space-y-2">
                {promoted.map(row => (
                  <div key={row.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3
                      ${row.is_promoted ? 'border-amber-400 bg-amber-50/30' : 'border-gray-100'}`}>
                    {row.is_promoted && (
                      <Zap size={16} className="text-amber-500 fill-amber-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{row.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{row.created_at.slice(0,10)}</p>
                    </div>
                    <button
                      onClick={() => togglePromoted(row)}
                      disabled={acting === row.id}
                      className={`flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                        row.is_promoted
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                      }`}>
                      {acting === row.id ? '…' : row.is_promoted ? '取消推广' : '设为推广'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : tab === 'community' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {communityPosts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                <p className="text-sm text-gray-400">暂无社区帖子</p>
              </div>
            ) : communityPosts.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.author?.name ?? '匿名'} · {p.type} · {p.area} · {p.created_at.slice(0, 10)}
                  </p>
                </div>
                <button onClick={() => deleteCommunityPost(p.id)} disabled={acting === p.id}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700
                             border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg
                             transition-colors disabled:opacity-50 flex-shrink-0">
                  <Trash2 size={13} /> 删除
                </button>
              </div>
            ))}
          </motion.div>
        ) : tab === 'verification' ? (
          verifications.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
              <BadgeCheck size={36} className="text-green-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">暂无待审核的认证申请</p>
            </div>
          ) : (
            <div className="space-y-3">
              {verifications.map(v => (
                <motion.div key={v.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                                    flex items-center justify-center text-white font-bold flex-shrink-0">
                      {v.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{v.name}</p>
                      <p className="text-xs text-gray-400 truncate">{v.email}</p>
                    </div>
                    <button onClick={() => navigate(`/provider/${v.id}`)}
                      className="text-xs text-primary-600 flex items-center gap-1 hover:underline">
                      <ExternalLink size={12} /> 查看主页
                    </button>
                  </div>

                  {/* Doc preview */}
                  {v.verification_doc_url ? (
                    <a href={v.verification_doc_url} target="_blank" rel="noopener noreferrer"
                      className="block mb-3">
                      {v.verification_doc_url.match(/\.(jpg|jpeg|png)$/i) ? (
                        <img src={v.verification_doc_url} alt="认证文件"
                          className="w-full max-h-48 object-contain rounded-xl border border-gray-100 bg-gray-50" />
                      ) : (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                          <BadgeCheck size={16} className="text-blue-500" />
                          <span className="text-sm text-blue-600">查看上传文件（PDF）</span>
                          <ExternalLink size={12} className="text-blue-400 ml-auto" />
                        </div>
                      )}
                    </a>
                  ) : (
                    <p className="text-xs text-gray-400 mb-3">未上传文件</p>
                  )}

                  <p className="text-xs text-gray-400 mb-3">申请时间：{v.created_at.slice(0, 10)}</p>

                  <div className="flex gap-2">
                    <button onClick={() => rejectVerification(v.id)} disabled={!!acting}
                      className="flex-1 flex items-center justify-center gap-1 text-sm text-gray-500
                                 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50
                                 disabled:opacity-50 transition-colors">
                      <X size={14} /> 拒绝
                    </button>
                    <button onClick={() => approveVerification(v.id)} disabled={!!acting}
                      className="flex-1 flex items-center justify-center gap-1 text-sm text-white
                                 bg-green-500 hover:bg-green-600 rounded-xl py-2.5 font-semibold
                                 disabled:opacity-50 transition-colors">
                      <BadgeCheck size={14} /> {acting === v.id ? '处理中…' : '批准认证'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : tab === 'reports' ? (
          reports.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
              <CheckCircle2 size={36} className="text-green-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">暂无待处理举报</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(r => (
                <motion.div key={r.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                >
                  {/* Report meta */}
                  <div className="flex items-center gap-2 mb-3">
                    <Flag size={14} className="text-red-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-red-500">{REASON_LABEL[r.reason] ?? r.reason}</span>
                    <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
                  </div>

                  {/* Review content */}
                  {r.review ? (
                    <div className="bg-gray-50 rounded-xl p-3 mb-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Star size={12} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-semibold text-gray-700">{r.review.rating} 星</span>
                        {r.review.service?.id && (
                          <button onClick={() => navigate(`/service/${r.review!.service!.id}`)}
                            className="text-xs text-primary-600 underline ml-auto">
                            {r.review.service.title}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{r.review.comment || '（无文字评价）'}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-3">评价已被删除</p>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 flex-1">
                      举报人：{r.reporter?.name ?? '匿名'}
                    </span>
                    <button
                      onClick={() => dismiss(r.id)}
                      disabled={!!acting}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {acting === r.id ? '处理中…' : '忽略'}
                    </button>
                    {r.review && (
                      <button
                        onClick={() => removeReview(r)}
                        disabled={!!acting}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Trash2 size={12} />删除评价
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : tab === 'membership' ? (
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
                        <button onClick={() => grantMembership(row, 'L2')} disabled={acting === row.id}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors font-semibold disabled:opacity-50">
                          <Crown size={11} /> 授予L2 +30天
                        </button>
                        <button onClick={() => grantMembership(row, 'L3')} disabled={acting === row.id}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-900 text-amber-400 hover:bg-zinc-700 transition-colors font-semibold disabled:opacity-50">
                          <Crown size={11} /> 授予L3 +30天
                        </button>
                        {effectiveLevel !== 'L1' && (
                          <button onClick={() => revokeMembership(row)} disabled={acting === row.id}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50">
                            <X size={11} /> 撤销会员
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        ) : tab === 'inquiries' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {inquiries.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                <Inbox size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">暂无询价记录</p>
              </div>
            ) : inquiries.map(inq => (
              <div key={inq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                      {inq.category_id}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
                      inq.status === 'open' ? 'bg-green-50 text-green-600' :
                      inq.status === 'matched' ? 'bg-blue-50 text-blue-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{inq.status}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{inq.created_at.slice(0, 10)}</span>
                </div>

                {/* Customer info */}
                <div className="text-sm text-gray-800">
                  <p className="font-medium">{inq.name} · {inq.phone}{inq.wechat ? ` · 微信: ${inq.wechat}` : ''}</p>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">{inq.description}</p>
                  {(inq.budget || inq.timing) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {inq.budget ? `预算: $${inq.budget}` : ''}{inq.budget && inq.timing ? ' · ' : ''}{inq.timing}
                    </p>
                  )}
                </div>

                {/* Matched providers */}
                <div className="border-t border-gray-50 pt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                    <Mail size={12} /> 已通知服务商（{inq.matches.length}）
                  </p>
                  {inq.matches.length === 0 ? (
                    <p className="text-xs text-gray-400">无匹配服务商</p>
                  ) : (
                    <div className="space-y-1.5">
                      {inq.matches.map(m => (
                        <div key={m.id} className="flex items-center gap-2 text-xs text-gray-600">
                          <CheckCheck size={12} className="text-green-500 flex-shrink-0" />
                          <span className="font-medium">{m.provider_name}</span>
                          <span className="text-gray-400">{m.provider_email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        ) : tab === 'users' ? (
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
                              onClick={() => setUserRole(u.id, 'provider')}
                              disabled={acting === u.id}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors disabled:opacity-50"
                            >
                              <UserCog size={12} /> 设为服务商
                            </button>
                          )}
                          {isProvider && (
                            <button
                              onClick={() => setUserRole(u.id, 'user')}
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
        ) : tab === 'services' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500 flex-1">
                共 <strong>{newServices.length}</strong> 条 · 在线 <strong className="text-green-600">{newServices.filter(s => s.is_available).length}</strong> · 已下架 <strong className="text-gray-400">{newServices.filter(s => !s.is_available).length}</strong>
              </span>
              {selectedSvcs.size > 0 && (
                <button
                  onClick={bulkTakedown}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <Trash2 size={14} /> 批量下架 ({selectedSvcs.size})
                </button>
              )}
              <button
                onClick={toggleSelectAll}
                className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {selectedSvcs.size === newServices.filter(s => s.is_available).length && newServices.filter(s => s.is_available).length > 0
                  ? '取消全选' : '全选在线'}
              </button>
              <button onClick={loadNewServices}
                className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                刷新
              </button>
            </div>

            {/* Service list */}
            {newServices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
                暂无服务记录
              </div>
            ) : (
              <div className="space-y-2">
                {newServices.map(svc => (
                  <div
                    key={svc.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
                      !svc.is_available
                        ? 'border-gray-100 opacity-50'
                        : selectedSvcs.has(svc.id)
                        ? 'border-red-300 bg-red-50/40'
                        : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox — only for online services */}
                      {svc.is_available && (
                        <input
                          type="checkbox"
                          checked={selectedSvcs.has(svc.id)}
                          onChange={() => toggleSelect(svc.id)}
                          className="mt-1 accent-red-500 w-4 h-4 flex-shrink-0 cursor-pointer"
                        />
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 truncate">{svc.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{svc.category_id}</span>
                          {svc.is_promoted && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                              <Zap size={10} /> 推广
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            svc.is_available ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {svc.is_available ? '在线' : '已下架'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{svc.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {svc.provider?.name ?? '未知'} · {svc.provider?.email ?? ''}
                          <span className="ml-2 text-gray-300">{svc.created_at.slice(0, 10)}</span>
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        <a
                          href={`/service/${svc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors"
                          title="查看详情"
                        >
                          <ExternalLink size={14} />
                        </a>
                        {svc.is_available ? (
                          <button
                            onClick={() => takedownService(svc.id)}
                            disabled={acting === svc.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={12} /> 下架
                          </button>
                        ) : (
                          <button
                            onClick={() => restoreService(svc.id)}
                            disabled={acting === svc.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} /> 恢复
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}
