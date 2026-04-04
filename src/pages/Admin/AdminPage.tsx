// ─── Admin Page ────────────────────────────────────────────────────────────────
// Route: /admin  — only accessible by users with role='admin' in users table
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Flag, CheckCircle2, Trash2, ChevronLeft, Users, Briefcase, Home, ShoppingBag, Calendar, Wrench, Star } from 'lucide-react'
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

  const [allowed,  setAllowed]  = useState<boolean | null>(null)
  const [reports,  setReports]  = useState<ReportRow[]>([])
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [tab,      setTab]      = useState<'reports' | 'overview'>('reports')
  const [loading,  setLoading]  = useState(true)
  const [acting,   setActing]   = useState<string | null>(null)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    supabase.from('users').select('role').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.role !== 'admin') { navigate('/'); return }
        setAllowed(true)
        loadAll()
      })
  }, [user])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadReports(), loadStats()])
    setLoading(false)
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
    const [users, services, jobs, properties, secondhand, events, reports] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }),
      supabase.from('jobs').select('id', { count: 'exact', head: true }),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('secondhand').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('review_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setStats({
      users:           users.count ?? 0,
      services:        services.count ?? 0,
      jobs:            jobs.count ?? 0,
      properties:      properties.count ?? 0,
      secondhand:      secondhand.count ?? 0,
      events:          events.count ?? 0,
      pending_reports: reports.count ?? 0,
    })
  }

  async function dismiss(reportId: string) {
    setActing(reportId)
    await supabase.from('review_reports').update({ status: 'dismissed' }).eq('id', reportId)
    setReports(prev => prev.filter(r => r.id !== reportId))
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
          {(['reports', 'overview'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'reports' ? `待处理举报 ${stats ? `(${stats.pending_reports})` : ''}` : '数据概览'}
            </button>
          ))}
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
                        {r.review.service && (
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
        ) : null}
      </div>
    </div>
  )
}
