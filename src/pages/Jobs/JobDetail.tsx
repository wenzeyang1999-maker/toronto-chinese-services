// ─── Job Detail Page ──────────────────────────────────────────────────────────
// Route: /jobs/:id
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronLeft, MapPin, Phone, MessageCircle, Copy,
  Briefcase, Clock, DollarSign, User, ExternalLink,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  JOB_CATEGORY_CONFIG, JOB_TYPE_CONFIG, SALARY_TYPE_LABEL, getCategoryLabel, type Job,
} from './types'
import SaveButton from '../../components/SaveButton/SaveButton'
import ShareButton from '../../components/ShareButton/ShareButton'

export default function JobDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [job,     setJob]     = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('jobs')
      .select('*, poster:users(id, name, avatar_url, role)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setJob({
            ...data,
            poster: Array.isArray(data.poster) ? (data.poster[0] ?? null) : (data.poster ?? null),
          } as Job)
        }
        setLoading(false)
      })
  }, [id])

  async function copyWechat() {
    if (!job?.contact_wechat) return
    try {
      await navigator.clipboard.writeText(job.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert(`微信号：${job.contact_wechat}`)
    }
  }

  const salaryLabel = !job ? '' :
    job.salary_type === 'negotiable'
      ? '薪资面议'
      : job.salary_min && job.salary_max
        ? `$${job.salary_min} – $${job.salary_max}${SALARY_TYPE_LABEL[job.salary_type]}`
        : job.salary_min
          ? `$${job.salary_min} 起${SALARY_TYPE_LABEL[job.salary_type]}`
          : '薪资面议'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800 flex-1 truncate">
          {loading ? '加载中…' : (job?.title ?? '职位不存在')}
        </span>
        {job && <SaveButton type="job" id={job.id} size={20} className="w-9 h-9" />}
        {job && <ShareButton title={job.title} size={18} className="w-9 h-9" />}
      </div>

      {loading ? (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
        </div>
      ) : !job ? (
        <div className="text-center py-20 text-gray-400">
          <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">职位不存在或已下线</p>
          <button onClick={() => navigate('/jobs')}
            className="mt-3 text-primary-600 text-sm underline">返回列表</button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

          {/* ── Main card ─────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
          >
            {/* Title + type badge */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-xl font-bold text-gray-900 leading-tight flex-1">
                {job.title}
              </h1>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${JOB_TYPE_CONFIG[job.job_type].color}`}>
                {JOB_TYPE_CONFIG[job.job_type].label}
              </span>
            </div>

            {/* Company */}
            <p className="text-sm text-gray-600 font-medium mb-4">
              {job.company_name ?? job.poster?.name ?? '雇主'}
            </p>

            {/* Info pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              <InfoPill icon={<Briefcase size={13} />}
                text={`${JOB_CATEGORY_CONFIG[job.category].emoji} ${getCategoryLabel(job)}`} />
              <InfoPill icon={<DollarSign size={13} />} text={salaryLabel} highlight />
              {job.area && job.area.length > 0 && (
                <InfoPill icon={<MapPin size={13} />} text={job.area.join('·')} />
              )}
              <InfoPill icon={<Clock size={13} />}
                text={`发布于 ${new Date(job.created_at).toLocaleDateString('zh-CN')}`} />
            </div>

            {/* Description */}
            <Section title="职位描述">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
            </Section>

            {job.requirements && (
              <Section title="任职要求">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {job.requirements}
                </p>
              </Section>
            )}

            {job.benefits && (
              <Section title="福利待遇">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {job.benefits}
                </p>
              </Section>
            )}
          </motion.div>

          {/* ── Contact card ──────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
          >
            <h2 className="text-sm font-semibold text-gray-700 mb-4">联系雇主</h2>

            <div className="flex items-center gap-3 mb-4">
              {/* Poster avatar — clickable if provider */}
              <div
                onClick={() => job.poster && navigate(`/provider/${job.poster.id}`)}
                className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
              >
                {job.poster?.avatar_url ? (
                  <img src={job.poster.avatar_url} alt={job.contact_name}
                    className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User size={18} className="text-primary-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{job.contact_name}</p>
                {job.company_name && (
                  <p className="text-xs text-gray-400">{job.company_name}</p>
                )}
              </div>
              {job.poster && (
                <button
                  onClick={() => navigate(`/provider/${job.poster!.id}`)}
                  className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold
                             bg-primary-50 hover:bg-primary-100 border border-primary-200
                             px-3 py-1.5 rounded-xl transition-colors"
                >
                  <ExternalLink size={12} />
                  查看主页
                </button>
              )}
            </div>

            <div className="flex gap-3">
              {/* Call button */}
              <a
                href={`tel:${job.contact_phone}`}
                className="flex-1 flex items-center justify-center gap-2
                           bg-primary-600 hover:bg-primary-700 active:scale-95
                           text-white text-sm font-semibold py-3 rounded-xl
                           transition-all"
              >
                <Phone size={16} />
                {job.contact_phone}
              </a>

              {/* WeChat button */}
              {job.contact_wechat && (
                <button
                  onClick={copyWechat}
                  className="flex items-center justify-center gap-2
                             bg-green-500 hover:bg-green-600 active:scale-95
                             text-white text-sm font-semibold px-4 py-3 rounded-xl
                             transition-all"
                >
                  {copied ? <Copy size={16} /> : <MessageCircle size={16} />}
                  {copied ? '已复制' : '微信'}
                </button>
              )}
            </div>

            {job.contact_wechat && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                微信号：{job.contact_wechat}
              </p>
            )}
          </motion.div>

          {/* ── Post your own job CTA ─────────────────────────────────────── */}
          {!user || user.id !== job.poster_id ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-primary-50 border border-primary-100 rounded-2xl p-4 text-center"
            >
              <p className="text-sm text-primary-700 font-medium mb-2">有职位要招人？</p>
              <button
                onClick={() => user ? navigate('/jobs/post') : navigate('/login')}
                className="text-sm text-primary-600 font-semibold underline"
              >
                免费发布招聘
              </button>
            </motion.div>
          ) : null}

        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  )
}

function InfoPill({ icon, text, highlight = false }: { icon: React.ReactNode; text: string; highlight?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
      highlight ? 'bg-primary-50 text-primary-700 font-semibold' : 'bg-gray-100 text-gray-600'
    }`}>
      {icon}
      {text}
    </span>
  )
}
