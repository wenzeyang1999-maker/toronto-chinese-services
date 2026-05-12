// ─── Post Job Page ────────────────────────────────────────────────────────────
// Route: /jobs/post
// ?type=hiring (default) | ?type=seeking
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useJobStore } from '../../store/jobStore'
import LocationInput, { type LocationResult } from '../../components/LocationInput/LocationInput'
import {
  JOB_CATEGORY_CONFIG, JOB_TYPE_CONFIG, SALARY_TYPE_LABEL,
  type JobCategory, type JobType, type SalaryType, type Job, type ListingType,
} from './types'
import { toast } from '../../lib/toast'
import { moderateContent } from '../../hooks/useContentModeration'

const GTA_AREAS = [
  '多伦多市区', '北约克', '士嘉堡', '密西沙加', '万锦',
  '列治文山', '奥克维尔', '宾顿', '安省其他',
]

interface FormState {
  listing_type: ListingType
  title: string
  company_name: string
  category: JobCategory
  category_other: string
  job_type: JobType
  description: string
  requirements: string
  benefits: string
  salary_min: string
  salary_max: string
  salary_type: SalaryType
  area: string[]
  contact_name: string
  contact_phone: string
  contact_wechat: string
}

const INITIAL: FormState = {
  listing_type: 'hiring',
  title: '', company_name: '', category: 'other', category_other: '', job_type: 'fulltime',
  description: '', requirements: '', benefits: '',
  salary_min: '', salary_max: '', salary_type: 'negotiable',
  area: [], contact_name: '', contact_phone: '', contact_wechat: '',
}

export default function PostJob() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const user           = useAuthStore((s) => s.user)
  const addJob         = useJobStore((s) => s.addJob)

  const initialType = (searchParams.get('type') === 'seeking' ? 'seeking' : 'hiring') as ListingType

  const [form,       setForm]       = useState<FormState>({ ...INITIAL, listing_type: initialType })
  const [errors,     setErrors]     = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)
  const [location,   setLocation]   = useState<LocationResult | null>(null)

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])

  // Pre-fill contact from profile
  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name, phone, wechat').eq('id', user.id).single()
      .then(({ data }) => {
        if (!data) return
        setForm((f) => ({
          ...f,
          contact_name:   data.name   ?? f.contact_name,
          contact_phone:  data.phone  ?? f.contact_phone,
          contact_wechat: data.wechat ?? f.contact_wechat,
        }))
      })
  }, [user])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const isHiring  = form.listing_type === 'hiring'
  const isSeeking = form.listing_type === 'seeking'

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.title.trim())         e.title         = isHiring ? '请填写职位名称' : '请填写求职标题'
    if (!form.description.trim())   e.description   = isHiring ? '请填写职位描述' : '请介绍您的技能经验'
    if (form.area.length === 0)     e.area          = isHiring ? '请选择至少一个工作地区' : '请选择至少一个可服务地区'
    if (!form.contact_name.trim())  e.contact_name  = '请填写联系人姓名'
    if (!form.contact_phone.trim()) e.contact_phone = '请填写联系电话'
    if (form.salary_type !== 'negotiable') {
      if (form.salary_min && form.salary_max &&
          parseFloat(form.salary_min) > parseFloat(form.salary_max)) {
        e.salary_max = '最高不能低于最低'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !validate()) return
    setSubmitting(true)

    const modResult = await moderateContent({ title: form.title, description: form.description })
    if (!modResult.pass) {
      toast(`内容审核未通过：${modResult.reason ?? '包含违规内容'}`, 'error')
      setSubmitting(false)
      return
    }

    const payload = {
      poster_id:      user.id,
      listing_type:   form.listing_type,
      title:          form.title.trim(),
      company_name:   isHiring ? (form.company_name.trim() || null) : null,
      category:       form.category,
      category_other: form.category === 'other' ? (form.category_other.trim() || null) : null,
      job_type:       form.job_type,
      description:    form.description.trim(),
      requirements:   isHiring ? (form.requirements.trim() || null) : null,
      benefits:       form.benefits.trim() || null,
      salary_min:     form.salary_type !== 'negotiable' && form.salary_min ? parseFloat(form.salary_min) : null,
      salary_max:     form.salary_type !== 'negotiable' && form.salary_max ? parseFloat(form.salary_max) : null,
      salary_type:    form.salary_type,
      area:           form.area.length > 0 ? form.area : null,
      city:           'Toronto',
      address:        location?.address ?? null,
      lat:            (location?.lat != null && location?.lng != null && !(location.lat === 0 && location.lng === 0)) ? location.lat : null,
      lng:            (location?.lat != null && location?.lng != null && !(location.lat === 0 && location.lng === 0)) ? location.lng : null,
      contact_name:   form.contact_name.trim(),
      contact_phone:  form.contact_phone.trim(),
      contact_wechat: form.contact_wechat.trim() || null,
      is_active:      true,
    }

    const { data, error } = await supabase.from('jobs').insert(payload).select('*, poster:users(id, name, avatar_url, role)').single()
    setSubmitting(false)

    if (error) {
      setErrors({ title: `发布失败：${error.message}` })
      return
    }

    if (data) {
      addJob({ ...data, poster: Array.isArray(data.poster) ? (data.poster[0] ?? null) : (data.poster ?? null) } as Job)
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center max-w-sm w-full"
        >
          <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isHiring ? '职位已发布！' : '求职帖已发布！'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isHiring ? '求职者可以联系您了' : '雇主可以联系您了'}
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={() => navigate('/jobs')}
              className="w-full bg-primary-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-primary-700 transition-colors">
              查看列表
            </button>
            <button onClick={() => { setForm({ ...INITIAL, listing_type: form.listing_type }); setDone(false) }}
              className="w-full border border-gray-200 text-gray-600 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-colors">
              继续发布
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800">
          {isHiring ? '发布招聘' : '发布求职'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── 招聘 / 求职 切换 ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex gap-1">
          <TypeTab
            active={isHiring}
            onClick={() => set('listing_type', 'hiring')}
            emoji="💼"
            label="我要招人"
            sub="发布职位，招募员工"
          />
          <TypeTab
            active={isSeeking}
            onClick={() => set('listing_type', 'seeking')}
            emoji="🙋"
            label="我要找工作"
            sub="发布技能，寻找雇主"
          />
        </div>

        {/* ── 基本信息 ─────────────────────────────────────────────────────── */}
        <Card title="基本信息">
          <Field label={isHiring ? '职位名称' : '求职标题'} required error={errors.title}>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder={isHiring ? '例：餐厅全职厨师、兼职收银员' : '例：滑雪教练、平面设计师、中文家教'}
              className={input(!!errors.title)} />
          </Field>

          {isHiring && (
            <Field label="公司 / 雇主名称（选填）">
              <input value={form.company_name} onChange={(e) => set('company_name', e.target.value)}
                placeholder="个人雇主可留空"
                className={input(false)} />
            </Field>
          )}

          {/* Category */}
          <Field label={isHiring ? '职位类别' : '技能类别'} required>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(JOB_CATEGORY_CONFIG) as JobCategory[]).map((k) => (
                <button key={k} type="button"
                  onClick={() => set('category', k)}
                  className={`text-sm px-3 py-1.5 rounded-xl border transition-colors ${
                    form.category === k
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {JOB_CATEGORY_CONFIG[k].emoji} {JOB_CATEGORY_CONFIG[k].label}
                </button>
              ))}
            </div>
            {form.category === 'other' && (
              <input
                value={form.category_other}
                onChange={(e) => set('category_other', e.target.value)}
                placeholder={isHiring ? '请输入职位类型，例：滑雪教练、摄影师' : '请输入技能类型，例：滑雪教练、摄影师'}
                className={input(false) + ' mt-2'}
              />
            )}
          </Field>

          {/* Job type */}
          <Field label="工作性质" required>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(JOB_TYPE_CONFIG) as JobType[]).map((k) => (
                <button key={k} type="button"
                  onClick={() => set('job_type', k)}
                  className={`text-sm px-4 py-1.5 rounded-xl border transition-colors ${
                    form.job_type === k
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {JOB_TYPE_CONFIG[k].label}
                </button>
              ))}
            </div>
          </Field>

          {/* Area — multi-select */}
          <Field label={isHiring ? '工作地区' : '可服务地区'} required error={errors.area}>
            <div className="flex flex-wrap gap-2">
              {GTA_AREAS.map((a) => {
                const selected = form.area.includes(a)
                return (
                  <button key={a} type="button"
                    onClick={() => set('area', selected
                      ? form.area.filter((x) => x !== a)
                      : [...form.area, a]
                    )}
                    className={`text-sm px-3 py-1.5 rounded-xl border transition-colors ${
                      selected
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
            {form.area.length > 0 && (
              <p className="text-xs text-gray-400 mt-1.5">已选：{form.area.join('、')}</p>
            )}
          </Field>
        </Card>

        {/* ── 薪资 ─────────────────────────────────────────────────────────── */}
        <Card title={isHiring ? '薪资待遇' : '期望薪资'}>
          <Field label="薪资类型" required>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SALARY_TYPE_LABEL) as SalaryType[]).map((k) => (
                <button key={k} type="button"
                  onClick={() => set('salary_type', k)}
                  className={`text-sm px-4 py-1.5 rounded-xl border transition-colors ${
                    form.salary_type === k
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {k === 'negotiable' ? '面议' : SALARY_TYPE_LABEL[k].replace('/ ', '按')}
                </button>
              ))}
            </div>
          </Field>

          {form.salary_type !== 'negotiable' && (
            <div className="flex items-center gap-3">
              <Field label={isHiring ? '最低薪资' : '期望最低'} className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-sm">$</span>
                  <input type="number" min="0" value={form.salary_min}
                    onChange={(e) => set('salary_min', e.target.value)}
                    placeholder="0"
                    className={`${input(false)} flex-1`} />
                </div>
              </Field>
              <span className="text-gray-400 mt-5">–</span>
              <Field label={isHiring ? '最高薪资' : '期望最高'} className="flex-1" error={errors.salary_max}>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-sm">$</span>
                  <input type="number" min="0" value={form.salary_max}
                    onChange={(e) => set('salary_max', e.target.value)}
                    placeholder="不限"
                    className={`${input(!!errors.salary_max)} flex-1`} />
                </div>
              </Field>
            </div>
          )}

          {isHiring && (
            <Field label="福利待遇（选填）">
              <textarea value={form.benefits} onChange={(e) => set('benefits', e.target.value)}
                rows={2} placeholder="例：包吃住、有小费、员工折扣…"
                className={input(false) + ' resize-none'} />
            </Field>
          )}

          {isSeeking && (
            <Field label="其他说明（选填）">
              <textarea value={form.benefits} onChange={(e) => set('benefits', e.target.value)}
                rows={2} placeholder="例：持有驾照、可提供上门服务、有证书…"
                className={input(false) + ' resize-none'} />
            </Field>
          )}
        </Card>

        {/* ── 详情 ─────────────────────────────────────────────────────────── */}
        <Card title={isHiring ? '职位详情' : '个人介绍'}>
          <Field label={isHiring ? '职位描述' : '技能 / 经验描述'} required error={errors.description}>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={5}
              placeholder={isHiring
                ? '描述工作内容、工作时间、工作环境…'
                : '介绍您的技能、经验、可以提供什么服务…'}
              className={input(!!errors.description) + ' resize-none'} />
          </Field>

          {isHiring && (
            <Field label="任职要求（选填）">
              <textarea value={form.requirements} onChange={(e) => set('requirements', e.target.value)}
                rows={3} placeholder="例：需要有驾照、会粤语普通话、有相关经验…"
                className={input(false) + ' resize-none'} />
            </Field>
          )}
        </Card>

        {/* ── 联系方式 ─────────────────────────────────────────────────────── */}
        <Card title="联系方式">
          <Field label="姓名" required error={errors.contact_name}>
            <input value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)}
              placeholder="联系人姓名"
              className={input(!!errors.contact_name)} />
          </Field>
          <Field label="联系电话" required error={errors.contact_phone}>
            <input type="tel" value={form.contact_phone}
              onChange={(e) => set('contact_phone', e.target.value)}
              placeholder="647-xxx-xxxx"
              className={input(!!errors.contact_phone)} />
          </Field>
          <Field label="微信号（选填）">
            <input value={form.contact_wechat} onChange={(e) => set('contact_wechat', e.target.value)}
              placeholder="微信号"
              className={input(false)} />
          </Field>
          <Field label="所在位置（选填）">
            <LocationInput onChange={setLocation} />
          </Field>
        </Card>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={submitting}
          whileTap={{ scale: submitting ? 1 : 0.97 }}
          className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold text-base
                     hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? '发布中…' : isHiring ? '发布招聘' : '发布求职'}
        </motion.button>

        <div className="h-4" />
      </form>
    </div>
  )
}

// ─── Type toggle tab ──────────────────────────────────────────────────────────
function TypeTab({ active, onClick, emoji, label, sub }: {
  active: boolean; onClick: () => void; emoji: string; label: string; sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
        active
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-50'
      }`}
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <div>
        <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-800'}`}>{label}</p>
        <p className={`text-xs ${active ? 'text-primary-100' : 'text-gray-400'}`}>{sub}</p>
      </div>
    </button>
  )
}

// ─── Local UI helpers ─────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label, required, error, className = '', children,
}: {
  label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

const input = (hasError: boolean) =>
  `w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all
   ${hasError
     ? 'border-red-300 focus:ring-2 focus:ring-red-200'
     : 'border-gray-200 focus:ring-2 focus:ring-primary-300 focus:border-transparent'
   }`
