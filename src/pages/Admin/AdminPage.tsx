// ─── Admin Page ────────────────────────────────────────────────────────────────
// Route: /admin  — only accessible by users with role='admin' in users table
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Flag, CheckCircle2, Trash2, ChevronLeft, Users, Briefcase, Home, ShoppingBag, Calendar, Wrench, Star, BadgeCheck, X, ExternalLink, Zap, Crown, Search, Inbox, Mail, CheckCheck, Ban, UserCheck, UserCog, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import AdminNotificationsBell from '../../components/AdminNotifications/AdminNotificationsBell'

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
  pending_content_reports: number
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

interface ContentReportRow {
  id: string
  content_type: 'community_post' | 'community_comment' | 'service' | 'secondhand' | 'job' | 'property' | 'event'
  content_id: string
  content_title: string
  reason: string
  status: string
  created_at: string
  reporter: { id: string; name: string } | null
}

interface PromoRequestRow {
  id: string
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  service: { id: string; title: string } | null
  provider: { id: string; name: string; email: string } | null
}

interface AuditLogRow {
  id: string
  action_type: string
  target_type: string
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
  actor: { id: string; name: string; email: string } | null
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
  price: number | null
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
  business_verified: boolean
  referral_code: string | null
}

interface AdminNotice {
  type: 'success' | 'error'
  text: string
}

const REASON_LABEL: Record<string, string> = {
  irrelevant: '内容无关',
  malicious:  '恶意攻击',
  fake:       '虚假评价',
  spam:       '垃圾广告',
  other:      '其他',
}

const INQUIRY_STATUS_LABEL: Record<InquiryRow['status'], string> = {
  open: '待处理',
  matched: '已匹配',
  closed: '已关闭',
}

const ADMIN_ACTION_LABEL: Record<string, string> = {
  promote_on: '设为推广',
  promote_off: '取消推广',
  review_report_dismissed: '忽略评价举报',
  review_removed: '删除评价',
  verification_approved: '通过认证',
  verification_rejected: '拒绝认证',
  community_post_deleted: '删除社区帖子',
  inquiry_status_updated: '更新询价状态',
  membership_granted: '授予会员',
  membership_revoked: '撤销会员',
  service_takedown: '下架服务',
  service_restored: '恢复服务',
  service_bulk_takedown: '批量下架服务',
  service_content_updated: '编辑服务内容',
  user_role_updated: '修改用户角色',
  community_report_dismissed: '忽略社区举报',
  community_report_removed: '删除被举报帖子',
  community_comment_report_dismissed: '忽略评论举报',
  community_comment_report_removed: '删除被举报评论',
  takedown_job: '下架招聘',
  takedown_property: '下架房源',
  takedown_event: '下架活动',
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
  const [tab,            setTab]            = useState<'reports' | 'communityReports' | 'verification' | 'promoted' | 'promoRequests' | 'overview' | 'community' | 'membership' | 'inquiries' | 'users' | 'services' | 'logs'>('reports')
  const [inquiries,      setInquiries]      = useState<InquiryRow[]>([])
  const [contentReports, setContentReports] = useState<ContentReportRow[]>([])
  const [promoRequests,  setPromoRequests]  = useState<PromoRequestRow[]>([])
  const [auditLogs,      setAuditLogs]      = useState<AuditLogRow[]>([])
  const [communityPosts, setCommunityPosts] = useState<{ id: string; title: string; type: string; area: string; created_at: string; author: { name: string } | null }[]>([])
  const [loading,        setLoading]        = useState(true)
  const [acting,         setActing]         = useState<string | null>(null)
  const [memberSearch,   setMemberSearch]   = useState('')
  const [memberResults,  setMemberResults]  = useState<MemberRow[]>([])
  const [userSearch,     setUserSearch]     = useState('')
  const [userResults,    setUserResults]    = useState<UserRow[]>([])
  const [newServices,    setNewServices]    = useState<NewServiceRow[]>([])
  const [selectedSvcs,   setSelectedSvcs]   = useState<Set<string>>(new Set())
  const [notice,         setNotice]         = useState<AdminNotice | null>(null)
  const [logSearch,      setLogSearch]      = useState('')
  const [logActionFilter, setLogActionFilter] = useState<'all' | string>('all')
  const [logDateFrom,    setLogDateFrom]    = useState('')
  const [logDateTo,      setLogDateTo]      = useState('')
  const [editingSvcId,   setEditingSvcId]   = useState<string | null>(null)
  const [editTitle,      setEditTitle]      = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPrice,      setEditPrice]      = useState('')
  const [trendStats,        setTrendStats]        = useState<Record<string, number> | null>(null)
  const [svcStatusFilter,   setSvcStatusFilter]   = useState<'all' | 'online' | 'offline'>('all')
  const [svcCategoryFilter, setSvcCategoryFilter] = useState('all')
  const [showVerifHistory,  setShowVerifHistory]  = useState(false)
  const [verifHistory,      setVerifHistory]      = useState<VerificationRow[]>([])
  const [servicesHasMore,   setServicesHasMore]   = useState(false)
  const [inquiriesHasMore,  setInquiriesHasMore]  = useState(false)
  const [communityHasMore,  setCommunityHasMore]  = useState(false)

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
    await Promise.all([loadReports(), loadContentReports(), loadVerifications(), loadStats()])
    setLoading(false)
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

  async function searchPromoted() {
    const kw = promoSearch.trim()
    const query = supabase
      .from(promoTable)
      .select('id, title, is_promoted, created_at')
      .order('is_promoted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)
    if (kw) query.ilike('title', `%${kw}%`)
    const { data, error } = await query
    if (error) {
      showNotice('error', `加载推广列表失败：${error.message}`)
      return
    }
    setPromoted((data ?? []).map((r: any) => ({ ...r, table: promoTable })))
  }

  async function togglePromoted(row: PromotedRow) {
    setActing(row.id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_toggle_promoted', {
        item_id: row.id,
        table_name: row.table,
        promoted: !row.is_promoted,
      })
      if (error) throw error
    }, row.is_promoted ? '已取消推广' : '已设为推广')
    if (ok !== null) {
      setPromoted(prev => prev.map(r => r.id === row.id ? { ...r, is_promoted: !r.is_promoted } : r))
    }
    setActing(null)
  }

  async function loadVerifications() {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, verification_doc_url, verification_status, created_at')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: false })
    if (error) {
      showNotice('error', `加载认证列表失败：${error.message}`)
      return
    }
    if (data) setVerifications(data as VerificationRow[])
  }

  async function loadPromoRequests() {
    const { data, error } = await supabase
      .from('promo_requests')
      .select(`
        id, note, status, created_at, reviewed_at,
        service:service_id(id, title),
        provider:provider_id(id, name, email)
      `)
      .order('created_at', { ascending: false })
    if (error) { showNotice('error', `加载置顶申请失败：${error.message}`); return }
    if (data) {
      setPromoRequests(data.map((r: any) => ({
        ...r,
        service:  Array.isArray(r.service)  ? r.service[0]  : r.service,
        provider: Array.isArray(r.provider) ? r.provider[0] : r.provider,
      })))
    }
  }

  async function approvePromoRequest(row: PromoRequestRow, approved: boolean) {
    setActing(row.id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_approve_promo_request', {
        request_id: row.id,
        approved,
      })
      if (error) throw error
    }, approved ? '已批准置顶' : '已拒绝申请')
    if (ok !== null) {
      setPromoRequests(prev => prev.map(r =>
        r.id === row.id ? { ...r, status: approved ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() } : r
      ))
    }
    setActing(null)
  }

  async function loadReports() {
    const { data, error } = await supabase
      .from('review_reports')
      .select(`
        id, reason, status, created_at,
        review:review_id(id, rating, comment, service:service_id(id, title)),
        reporter:reporter_id(id, name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) {
      showNotice('error', `加载举报列表失败：${error.message}`)
      return
    }
    if (data) {
      setReports(data.map((r: any) => ({
        ...r,
        review:   Array.isArray(r.review)   ? r.review[0]   : r.review,
        reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
      })))
    }
  }

  async function loadContentReports() {
    const { data, error } = await supabase
      .from('content_reports')
      .select('id, content_type, content_id, content_title, reason, status, created_at, reporter:reporter_id(id, name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) {
      showNotice('error', `加载内容举报失败：${error.message}`)
      return
    }
    if (data) {
      setContentReports(data.map((r: any) => ({
        ...r,
        reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
      })))
    }
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

  async function dismiss(reportId: string) {
    setActing(reportId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_dismiss_review_report', { report_id: reportId })
      if (error) throw error
    }, '已忽略举报')
    if (ok !== null) {
      setReports(prev => prev.filter(r => r.id !== reportId))
    }
    setActing(null)
  }

  async function approveVerification(userId: string) {
    setActing(userId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_review_verification', {
        target_user_id: userId,
        approved: true,
      })
      if (error) throw error
    }, '已通过认证')
    if (ok !== null) {
      setVerifications(prev => prev.filter(v => v.id !== userId))
    }
    setActing(null)
  }

  async function rejectVerification(userId: string) {
    setActing(userId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_review_verification', {
        target_user_id: userId,
        approved: false,
      })
      if (error) throw error
    }, '已拒绝认证')
    if (ok !== null) {
      setVerifications(prev => prev.filter(v => v.id !== userId))
    }
    setActing(null)
  }

  async function loadCommunityPosts(append = false) {
    const PAGE = 30
    const start = append ? communityPosts.length : 0
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, title, type, area, created_at, author:author_id(name)')
      .order('created_at', { ascending: false })
      .range(start, start + PAGE - 1)
    if (error) {
      showNotice('error', `加载社区帖子失败：${error.message}`)
      return
    }
    const mapped = (data ?? []).map((p: any) => ({ ...p, author: Array.isArray(p.author) ? p.author[0] : p.author }))
    if (append) setCommunityPosts(prev => [...prev, ...mapped])
    else setCommunityPosts(mapped)
    setCommunityHasMore((data ?? []).length === PAGE)
  }

  async function deleteCommunityPost(postId: string) {
    setActing(postId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_delete_community_post', { post_id: postId })
      if (error) throw error
    }, '社区帖子已删除')
    if (ok !== null) {
      setCommunityPosts(prev => prev.filter(p => p.id !== postId))
    }
    setActing(null)
  }

  async function loadInquiries(append = false) {
    const PAGE = 30
    const start = append ? inquiries.length : 0
    const { data, error } = await supabase
      .from('inquiries')
      .select('id, category_id, description, budget, timing, name, phone, wechat, status, created_at')
      .order('created_at', { ascending: false })
      .range(start, start + PAGE - 1)
    if (error) {
      showNotice('error', `加载询价失败：${error.message}`)
      return
    }
    if (!data) return

    const ids = data.map((r: any) => r.id)
    const { data: matches, error: matchesError } = await supabase
      .from('inquiry_matches')
      .select('id, inquiry_id, provider_name, provider_email, email_sent')
      .in('inquiry_id', ids)
    if (matchesError) {
      showNotice('error', `加载询价匹配失败：${matchesError.message}`)
      return
    }

    const matchMap: Record<string, InquiryMatch[]> = {}
    for (const m of matches ?? []) {
      if (!matchMap[m.inquiry_id]) matchMap[m.inquiry_id] = []
      matchMap[m.inquiry_id].push(m)
    }
    const newItems = data.map((r: any) => ({ ...r, matches: matchMap[r.id] ?? [] }))
    if (append) setInquiries(prev => [...prev, ...newItems])
    else setInquiries(newItems)
    setInquiriesHasMore(data.length === PAGE)
  }

  async function updateInquiryStatus(inquiryId: string, status: InquiryRow['status']) {
    setActing(inquiryId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_inquiry_status', {
        inquiry_id: inquiryId,
        new_status: status,
      })
      if (error) throw error
    }, `询价状态已更新为${INQUIRY_STATUS_LABEL[status]}`)
    if (ok !== null) {
      setInquiries(prev => prev.map(inq => (
        inq.id === inquiryId ? { ...inq, status } : inq
      )))
    }
    setActing(null)
  }

  async function dismissContentReport(reportId: string) {
    setActing(reportId)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_dismiss_content_report', { p_report_id: reportId })
      if (error) throw error
    }, '已忽略举报')
    if (ok !== null) {
      setContentReports(prev => prev.filter(r => r.id !== reportId))
    }
    setActing(null)
  }

  async function removeReportedContent(report: ContentReportRow) {
    setActing(report.id)
    let rpcName = ''
    let rpcArgs: Record<string, string> = {}
    let successMsg = ''

    if (report.content_type === 'community_post') {
      rpcName = 'admin_remove_reported_post'
      rpcArgs = { p_report_id: report.id, p_post_id: report.content_id }
      successMsg = '已删除被举报帖子'
    } else if (report.content_type === 'community_comment') {
      rpcName = 'admin_remove_reported_comment'
      rpcArgs = { p_report_id: report.id, p_comment_id: report.content_id }
      successMsg = '已删除被举报评论'
    } else if (report.content_type === 'service') {
      rpcName = 'admin_remove_reported_service'
      rpcArgs = { p_report_id: report.id, p_service_id: report.content_id }
      successMsg = '服务已下架'
    } else if (report.content_type === 'secondhand') {
      rpcName = 'admin_remove_reported_secondhand'
      rpcArgs = { p_report_id: report.id, p_item_id: report.content_id }
      successMsg = '商品已删除'
    } else if (report.content_type === 'job') {
      rpcName = 'admin_remove_reported_job'
      rpcArgs = { p_report_id: report.id, p_job_id: report.content_id }
      successMsg = '招聘已下架'
    } else if (report.content_type === 'property') {
      rpcName = 'admin_remove_reported_property'
      rpcArgs = { p_report_id: report.id, p_property_id: report.content_id }
      successMsg = '房源已下架'
    } else if (report.content_type === 'event') {
      rpcName = 'admin_remove_reported_event'
      rpcArgs = { p_report_id: report.id, p_event_id: report.content_id }
      successMsg = '活动已下架'
    } else {
      setActing(null)
      return
    }

    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc(rpcName, rpcArgs)
      if (error) throw error
    }, successMsg)

    if (ok !== null) {
      setContentReports(prev => prev.filter(r =>
        !(r.content_type === report.content_type && r.content_id === report.content_id)
      ))
      if (report.content_type === 'community_post') {
        setCommunityPosts(prev => prev.filter(p => p.id !== report.content_id))
      }
    }
    setActing(null)
  }

  async function searchMembers() {
    const kw = memberSearch.trim()
    const query = supabase
      .from('users')
      .select('id, name, email, membership_level, membership_expires_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (kw) query.or(`name.ilike.%${kw}%,email.ilike.%${kw}%`)
    const { data, error } = await query
    if (error) {
      showNotice('error', `搜索会员失败：${error.message}`)
      return
    }
    setMemberResults((data ?? []) as MemberRow[])
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

  async function loadNewServices(append = false) {
    const PAGE = 40
    const start = append ? newServices.length : 0
    const { data, error } = await supabase
      .from('services')
      .select('id, title, description, price, category_id, is_available, is_promoted, created_at, provider:provider_id(id, name, email)')
      .order('created_at', { ascending: false })
      .range(start, start + PAGE - 1)
    if (error) {
      showNotice('error', `加载服务审核列表失败：${error.message}`)
      return
    }
    const mapped = (data ?? []).map((r: any) => ({
      ...r,
      provider: Array.isArray(r.provider) ? r.provider[0] : r.provider,
    }))
    if (append) setNewServices(prev => [...prev, ...mapped])
    else setNewServices(mapped)
    setServicesHasMore((data ?? []).length === PAGE)
  }

  async function loadTrendStats() {
    const { data, error } = await supabase.rpc('admin_stats_trend')
    if (!error && data) setTrendStats(data as Record<string, number>)
  }

  async function loadVerifHistory() {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, verification_doc_url, verification_status, created_at')
      .in('verification_status', ['approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setVerifHistory(data as VerificationRow[])
  }

  async function takedownService(id: string) {
    setActing(id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_service_availability', {
        service_id: id,
        available: false,
      })
      if (error) throw error
    }, '服务已下架')
    if (ok !== null) {
      setNewServices(prev => prev.map(s => s.id === id ? { ...s, is_available: false } : s))
      setSelectedSvcs(prev => { const n = new Set(prev); n.delete(id); return n })
    }
    setActing(null)
  }

  async function restoreService(id: string) {
    setActing(id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_set_service_availability', {
        service_id: id,
        available: true,
      })
      if (error) throw error
    }, '服务已恢复上线')
    if (ok !== null) {
      setNewServices(prev => prev.map(s => s.id === id ? { ...s, is_available: true } : s))
    }
    setActing(null)
  }

  async function bulkTakedown() {
    if (selectedSvcs.size === 0) return
    if (!confirm(`确定下架选中的 ${selectedSvcs.size} 条服务？`)) return
    const ids = Array.from(selectedSvcs)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_bulk_set_service_availability', {
        service_ids: ids,
        available: false,
      })
      if (error) throw error
    }, `已批量下架 ${ids.length} 条服务`)
    if (ok !== null) {
      setNewServices(prev => prev.map(s => ids.includes(s.id) ? { ...s, is_available: false } : s))
      setSelectedSvcs(new Set())
    }
  }

  function startEditService(svc: NewServiceRow) {
    setEditingSvcId(svc.id)
    setEditTitle(svc.title)
    setEditDescription(svc.description)
    setEditPrice(svc.price?.toString() ?? '')
  }

  function cancelEditService() {
    setEditingSvcId(null)
    setEditTitle('')
    setEditDescription('')
    setEditPrice('')
  }

  async function saveServiceEdit() {
    if (!editingSvcId) return
    setActing(editingSvcId)
    const id = editingSvcId
    const newPrice = editPrice.trim() === '' ? null : Number(editPrice)
    if (newPrice !== null && (isNaN(newPrice) || newPrice < 0)) {
      showNotice('error', '价格必须是非负数字')
      setActing(null)
      return
    }
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_update_service_content', {
        service_id: id,
        new_title: editTitle.trim(),
        new_description: editDescription.trim(),
        new_price: newPrice,
      })
      if (error) throw error
    }, '服务内容已更新')
    if (ok !== null) {
      setNewServices(prev => prev.map(s =>
        s.id === id ? { ...s, title: editTitle.trim(), description: editDescription.trim(), price: newPrice } : s
      ))
      cancelEditService()
    }
    setActing(null)
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
      .select('id, name, email, role, created_at, is_email_verified, business_verified, referral_code')
      .order('created_at', { ascending: false })
      .limit(30)
    if (kw) query.or(`name.ilike.%${kw}%,email.ilike.%${kw}%`)
    const { data, error } = await query
    if (error) {
      showNotice('error', `搜索用户失败：${error.message}`)
      return
    }
    setUserResults((data ?? []) as UserRow[])
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

  async function removeReview(report: ReportRow) {
    if (!report.review) return
    setActing(report.id)
    const ok = await runAdminAction(async () => {
      const { error } = await supabase.rpc('admin_remove_review', {
        review_id: report.review!.id,
        report_id: report.id,
      })
      if (error) throw error
    }, '评价已删除')
    if (ok !== null) {
      setReports(prev => prev.filter(r => r.review?.id !== report.review?.id))
    }
    setActing(null)
  }

  async function loadAuditLogs() {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('id, action_type, target_type, target_id, details, created_at, actor:actor_id(id, name, email)')
      .order('created_at', { ascending: false })
      .limit(80)
    if (error) {
      showNotice('error', `加载操作日志失败：${error.message}`)
      return
    }
    setAuditLogs((data ?? []).map((row: any) => ({
      ...row,
      details: row.details ?? {},
      actor: Array.isArray(row.actor) ? row.actor[0] : row.actor,
    })))
  }

  const filteredAuditLogs = auditLogs.filter((log) => {
    const actionMatch = logActionFilter === 'all' || log.action_type === logActionFilter
    if (!actionMatch) return false

    const logDate = log.created_at.slice(0, 10)
    if (logDateFrom && logDate < logDateFrom) return false
    if (logDateTo && logDate > logDateTo) return false

    const keyword = logSearch.trim().toLowerCase()
    if (!keyword) return true

    const haystack = [
      ADMIN_ACTION_LABEL[log.action_type] ?? log.action_type,
      log.action_type,
      log.target_type,
      log.target_id ?? '',
      log.actor?.name ?? '',
      log.actor?.email ?? '',
      JSON.stringify(log.details ?? {}),
    ].join(' ').toLowerCase()

    return haystack.includes(keyword)
  })

  const logActionOptions = Array.from(new Set(auditLogs.map(log => log.action_type)))

  function formatLogKey(key: string) {
    const labels: Record<string, string> = {
      role: '角色',
      status: '状态',
      level: '会员等级',
      membership_expires_at: '到期时间',
      ids: '批量对象',
      report_id: '举报 ID',
      post_id: '帖子 ID',
      comment_id: '评论 ID',
      table: '来源表',
    }
    return labels[key] ?? key.replace(/_/g, ' ')
  }

  function formatLogValue(value: unknown) {
    if (value === null || value === undefined || value === '') return '无'
    if (Array.isArray(value)) return value.join('、')
    if (typeof value === 'boolean') return value ? '是' : '否'
    if (typeof value === 'object') return JSON.stringify(value)
    if (typeof value === 'string') {
      if (value === 'open') return '待处理'
      if (value === 'matched') return '已匹配'
      if (value === 'closed') return '已关闭'
      if (value === 'user') return '普通用户'
      if (value === 'provider') return '服务商'
      if (value === 'admin') return '管理员'
      if (value === 'banned') return '已封禁'
      return value
    }
    return String(value)
  }

  function renderAuditDetails(details: Record<string, unknown>) {
    const entries = Object.entries(details ?? {}).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0
      return value !== null && value !== undefined && value !== ''
    })

    if (entries.length === 0) return null

    return (
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-3 text-xs">
            <span className="w-24 shrink-0 text-gray-400">{formatLogKey(key)}</span>
            <span className="text-gray-700 break-all">{formatLogValue(value)}</span>
          </div>
        ))}
      </div>
    )
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
            {([
              { key: 'reports',        label: `举报${stats ? ` (${stats.pending_reports})` : ''}`,                   onClick: () => setTab('reports') },
              { key: 'communityReports', label: `内容举报${stats ? ` (${stats.pending_content_reports})` : ''}`,     onClick: () => { setTab('communityReports'); loadContentReports() } },
              { key: 'verification',   label: `认证审核${stats ? ` (${stats.pending_verifications})` : ''}`,         onClick: () => { setTab('verification'); setShowVerifHistory(false) } },
              { key: 'promoted',       label: '置顶推广',     onClick: () => { setTab('promoted'); searchPromoted() } },
              { key: 'promoRequests',  label: `置顶申请${promoRequests.filter(r => r.status === 'pending').length > 0 ? ` (${promoRequests.filter(r => r.status === 'pending').length})` : ''}`, onClick: () => { setTab('promoRequests'); loadPromoRequests() } },
              { key: 'community',      label: '社区帖子',     onClick: () => { setTab('community'); loadCommunityPosts() } },
              { key: 'inquiries',      label: '询价',         onClick: () => { setTab('inquiries'); loadInquiries() } },
              { key: 'overview',       label: '数据概览',     onClick: () => { setTab('overview'); if (!trendStats) loadTrendStats() } },
              { key: 'membership',     label: '会员管理',     onClick: () => { setTab('membership'); searchMembers() } },
              { key: 'users',          label: '用户管理',     onClick: () => { setTab('users'); searchUsers() } },
              { key: 'services',       label: '服务审核',     onClick: () => { setTab('services'); loadNewServices() } },
              { key: 'logs',           label: '操作日志',     onClick: () => { setTab('logs'); loadAuditLogs() } },
            ] as { key: typeof tab; label: string; onClick: () => void }[]).map(({ key, label, onClick }) => (
              <button key={key} onClick={onClick}
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
        ) : tab === 'overview' && stats ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { icon: <Users size={20} />,       label: '注册用户',   value: stats.users,           color: 'text-blue-600 bg-blue-50',      tKey: 'users' },
                { icon: <Wrench size={20} />,       label: '服务',       value: stats.services,        color: 'text-primary-600 bg-primary-50', tKey: 'services' },
                { icon: <Briefcase size={20} />,    label: '招聘职位',   value: stats.jobs,            color: 'text-purple-600 bg-purple-50',  tKey: 'jobs' },
                { icon: <Home size={20} />,         label: '房源',       value: stats.properties,      color: 'text-green-600 bg-green-50',    tKey: 'properties' },
                { icon: <ShoppingBag size={20} />,  label: '闲置',       value: stats.secondhand,      color: 'text-orange-600 bg-orange-50',  tKey: 'secondhand' },
                { icon: <Calendar size={20} />,     label: '活动',       value: stats.events,          color: 'text-pink-600 bg-pink-50',      tKey: 'events' },
                { icon: <Flag size={20} />,         label: '待处理举报', value: stats.pending_reports,          color: 'text-red-600 bg-red-50',    tKey: null },
                { icon: <Flag size={20} />,         label: '内容举报',   value: stats.pending_content_reports,  color: 'text-orange-600 bg-orange-50', tKey: null },
              ].map(({ icon, label, value, color, tKey }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-400">{label}</p>
                    {tKey && trendStats && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        <span className="text-green-600 font-semibold">+{trendStats[`${tKey}_7d`] ?? 0}</span> 7天 ·{' '}
                        <span className="text-blue-600 font-semibold">+{trendStats[`${tKey}_30d`] ?? 0}</span> 30天
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!trendStats && (
              <button onClick={loadTrendStats}
                className="w-full py-2 text-xs text-primary-600 border border-primary-200 rounded-xl hover:bg-primary-50 transition-colors">
                加载增长趋势数据
              </button>
            )}
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
        ) : tab === 'promoRequests' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
              <Zap size={15} className="text-amber-500" />
              <span className="text-sm text-gray-500 flex-1">
                共 <strong className="text-amber-600">{promoRequests.filter(r => r.status === 'pending').length}</strong> 条待审核
              </span>
              <button onClick={loadPromoRequests}
                className="text-xs text-primary-600 font-semibold hover:underline">刷新</button>
            </div>

            {promoRequests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
                暂无置顶申请
              </div>
            ) : (
              <div className="space-y-2">
                {promoRequests.map(row => (
                  <div key={row.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 space-y-2
                      ${row.status === 'pending' ? 'border-amber-200' : 'border-gray-100 opacity-60'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {row.service?.title ?? '未知服务'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {row.provider?.name ?? '—'} · {row.provider?.email ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400">{row.created_at.slice(0, 10)} 申请</p>
                      </div>
                      <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                        row.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                        row.status === 'approved' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {row.status === 'pending' ? '待审核' : row.status === 'approved' ? '已批准' : '已拒绝'}
                      </span>
                    </div>

                    {row.note && (
                      <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                        留言：{row.note}
                      </p>
                    )}

                    {row.service?.id && (
                      <a href={`/service/${row.service.id}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                        <ExternalLink size={11} /> 查看服务
                      </a>
                    )}

                    {row.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => approvePromoRequest(row, true)}
                          disabled={acting === row.id}
                          className="flex-1 text-xs py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                          {acting === row.id ? '…' : <><Zap size={12} className="fill-white" /> 批准置顶</>}
                        </button>
                        <button
                          onClick={() => approvePromoRequest(row, false)}
                          disabled={acting === row.id}
                          className="flex-1 text-xs py-2 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 font-semibold disabled:opacity-50 transition-colors">
                          拒绝
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : tab === 'communityReports' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500 flex-1">
                待处理举报 <strong className="text-orange-600">{contentReports.length}</strong>
              </span>
              <button onClick={loadContentReports}
                className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                刷新
              </button>
            </div>
            {contentReports.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                <p className="text-sm text-gray-400">暂无待处理内容举报</p>
              </div>
            ) : (
              <div className="space-y-3">
                {contentReports.map(r => {
                  const typeLabel: Record<string, string> = {
                    community_post: '社区帖子', community_comment: '社区评论',
                    service: '服务', secondhand: '二手', job: '招聘',
                    property: '房产', event: '活动',
                  }
                  const actionLabel: Record<string, string> = {
                    community_post: '删除帖子', community_comment: '删除评论',
                    service: '下架服务', secondhand: '删除商品', job: '删除招聘',
                    property: '删除房源', event: '删除活动',
                  }
                  const viewPath: Record<string, string> = {
                    community_post: `/community/${r.content_id}`,
                    service: `/service/${r.content_id}`,
                    secondhand: `/secondhand/${r.content_id}`,
                  }
                  return (
                    <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Flag size={14} className="text-orange-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-orange-500">{REASON_LABEL[r.reason] ?? r.reason}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{typeLabel[r.content_type] ?? r.content_type}</span>
                        <span className="text-xs text-gray-400 ml-auto">{r.created_at.slice(0, 10)}</span>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{r.content_title || '（内容已删除）'}</span>
                          {viewPath[r.content_type] && (
                            <button onClick={() => navigate(viewPath[r.content_type])}
                              className="text-xs text-primary-600 underline flex-shrink-0">
                              查看
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 flex-1">举报人：{r.reporter?.name ?? '匿名'}</span>
                        <button
                          onClick={() => dismissContentReport(r.id)}
                          disabled={!!acting}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {acting === r.id ? '处理中…' : '忽略'}
                        </button>
                        <button
                          onClick={() => removeReportedContent(r)}
                          disabled={!!acting}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          <Trash2 size={12} /> {actionLabel[r.content_type] ?? '删除'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        ) : tab === 'community' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {communityPosts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                <p className="text-sm text-gray-400">暂无社区帖子</p>
              </div>
            ) : (
              <>
                {communityPosts.map(p => (
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
                {communityHasMore && (
                  <button
                    onClick={() => loadCommunityPosts(true)}
                    className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                  >
                    加载更多
                  </button>
                )}
              </>
            )}
          </motion.div>
        ) : tab === 'verification' ? (
          <div className="space-y-3">
            {/* Pending / History toggle */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowVerifHistory(false)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  !showVerifHistory ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                待审核 {verifications.length > 0 ? `(${verifications.length})` : ''}
              </button>
              <button
                onClick={() => { setShowVerifHistory(true); if (!verifHistory.length) loadVerifHistory() }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  showVerifHistory ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                已审核记录
              </button>
            </div>

            {showVerifHistory ? (
              verifHistory.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                  <p className="text-sm text-gray-400">暂无已审核记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {verifHistory.map(v => (
                    <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 flex-shrink-0 text-sm">
                        {v.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{v.name}</p>
                        <p className="text-xs text-gray-400 truncate">{v.email}</p>
                        <p className="text-xs text-gray-400">{v.created_at.slice(0, 10)}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${
                        v.verification_status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {v.verification_status === 'approved' ? '已通过' : '已拒绝'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : verifications.length === 0 ? (
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
          )}
          </div>
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
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        ) : tab === 'inquiries' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500 flex-1">
                共 <strong>{inquiries.length}</strong> 条 · 待处理 <strong className="text-green-600">{inquiries.filter(i => i.status === 'open').length}</strong> · 已匹配 <strong className="text-blue-600">{inquiries.filter(i => i.status === 'matched').length}</strong> · 已关闭 <strong className="text-gray-500">{inquiries.filter(i => i.status === 'closed').length}</strong>
              </span>
              <button onClick={() => loadInquiries()}
                className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                刷新
              </button>
            </div>
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
                    }`}>{INQUIRY_STATUS_LABEL[inq.status] ?? inq.status}</span>
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

                <div className="flex gap-2 flex-wrap">
                  {inq.status !== 'open' && (
                    <button
                      onClick={() => updateInquiryStatus(inq.id, 'open')}
                      disabled={acting === inq.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-semibold transition-colors disabled:opacity-50"
                    >
                      设为待处理
                    </button>
                  )}
                  {inq.status !== 'matched' && (
                    <button
                      onClick={() => updateInquiryStatus(inq.id, 'matched')}
                      disabled={acting === inq.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors disabled:opacity-50"
                    >
                      标记已匹配
                    </button>
                  )}
                  {inq.status !== 'closed' && (
                    <button
                      onClick={() => updateInquiryStatus(inq.id, 'closed')}
                      disabled={acting === inq.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
                    >
                      关闭询价
                    </button>
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
            {inquiriesHasMore && (
              <button
                onClick={() => loadInquiries(true)}
                className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                加载更多
              </button>
            )}
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
              <button onClick={() => loadNewServices()}
                className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                刷新
              </button>
            </div>

            {/* Filter chips */}
            {newServices.length > 0 && (
              <div className="flex gap-2 flex-wrap items-center">
                {(['all', 'online', 'offline'] as const).map(f => (
                  <button key={f} onClick={() => setSvcStatusFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                      svcStatusFilter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {{ all: '全部', online: '在线', offline: '已下架' }[f]}
                  </button>
                ))}
                <span className="text-gray-300">|</span>
                <select
                  value={svcCategoryFilter}
                  onChange={e => setSvcCategoryFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-xl px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="all">全部分类</option>
                  {Array.from(new Set(newServices.map(s => s.category_id))).sort().map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Service list */}
            {(() => {
              const filtered = newServices.filter(svc => {
                if (svcStatusFilter === 'online' && !svc.is_available) return false
                if (svcStatusFilter === 'offline' && svc.is_available) return false
                if (svcCategoryFilter !== 'all' && svc.category_id !== svcCategoryFilter) return false
                return true
              })
              return filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
                暂无服务记录
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(svc => (
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
                        <button
                          onClick={() => startEditService(svc)}
                          disabled={acting === svc.id || editingSvcId === svc.id}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                          title="编辑内容"
                        >
                          <Pencil size={14} />
                        </button>
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

                    {/* Inline edit form */}
                    {editingSvcId === svc.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">标题</label>
                          <input
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
                            maxLength={50}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">描述</label>
                          <textarea
                            value={editDescription}
                            onChange={e => setEditDescription(e.target.value)}
                            rows={3}
                            maxLength={500}
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">价格（留空保持不变）</label>
                          <input
                            type="number"
                            min="0"
                            value={editPrice}
                            onChange={e => setEditPrice(e.target.value)}
                            placeholder={svc.price?.toString() ?? '面议'}
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={cancelEditService}
                            className="flex-1 text-xs py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={saveServiceEdit}
                            disabled={acting === svc.id || !editTitle.trim() || !editDescription.trim()}
                            className="flex-1 text-xs py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                          >
                            {acting === svc.id ? '保存中…' : '保存'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
            })()}
            {servicesHasMore && (svcStatusFilter === 'all' && svcCategoryFilter === 'all') && (
              <button
                onClick={() => loadNewServices(true)}
                className="w-full py-3 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                加载更多
              </button>
            )}
          </motion.div>
        ) : tab === 'logs' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 flex-wrap">
              <input
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                placeholder="搜索动作、对象、操作者、详情"
                className="flex-1 min-w-[220px] text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300"
              />
              <select
                value={logActionFilter}
                onChange={e => setLogActionFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                <option value="all">全部动作</option>
                {logActionOptions.map(action => (
                  <option key={action} value={action}>
                    {ADMIN_ACTION_LABEL[action] ?? action}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={logDateFrom}
                onChange={e => setLogDateFrom(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              />
              <input
                type="date"
                value={logDateTo}
                onChange={e => setLogDateTo(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              />
              <button onClick={loadAuditLogs}
                className="px-3 py-2 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
                刷新
              </button>
            </div>
            <div className="text-xs text-gray-400 px-1">匹配到 {filteredAuditLogs.length} 条日志</div>
            {filteredAuditLogs.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                <p className="text-sm text-gray-400">暂无操作日志</p>
              </div>
            ) : filteredAuditLogs.map(log => (
              <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {ADMIN_ACTION_LABEL[log.action_type] ?? log.action_type}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">{log.created_at.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <p className="text-xs text-gray-500">
                  操作者：{log.actor?.name ?? '管理员'}{log.actor?.email ? ` · ${log.actor.email}` : ''}
                </p>
                <p className="text-xs text-gray-500">
                  对象：{log.target_type}{log.target_id ? ` · ${log.target_id}` : ''}
                </p>
                {renderAuditDetails(log.details)}
              </div>
            ))}
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}
