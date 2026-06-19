// ─── Post Job Page ────────────────────────────────────────────────────────────
// Route: /jobs/post
// ?type=hiring (default) | ?type=seeking
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useJobStore } from '../../store/jobStore'
import PostFormCard from '../../components/PostForm/PostFormCard'
import PostFormField from '../../components/PostForm/PostFormField'
import { postFormInput } from '../../components/PostForm/postFormInput'
import PostFormAreaPicker from '../../components/PostForm/PostFormAreaPicker'
import PostFormContact from '../../components/PostForm/PostFormContact'
import PostFormSuccess from '../../components/PostForm/PostFormSuccess'
import type { LocationResult } from '../../components/LocationInput/LocationInput'
import {
  JOB_CATEGORY_CONFIG, JOB_TYPE_CONFIG, SALARY_TYPE_LABEL,
  type JobCategory, type JobType, type SalaryType, type Job, type ListingType,
} from './types'
import { toast } from '../../lib/toast'
import { moderateContent } from '../../hooks/useContentModeration'
import { notifyFollowerNewListing } from '../../lib/notify'

const Card  = PostFormCard
const Field = PostFormField
const input = postFormInput

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
  const [submitting,   setSubmitting]  = useState(false)
  const [done,         setDone]        = useState(false)
  const [location,     setLocation]    = useState<LocationResult | null>(null)
  const [submitError,  setSubmitError] = useState<string | null>(null)

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
    setSubmitError(null)
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
      setSubmitError('发布失败，请稍后重试')
      setSubmitting(false)
      return
    }

    if (data) {
      addJob({ ...data, poster: Array.isArray(data.poster) ? (data.poster[0] ?? null) : (data.poster ?? null) } as Job)

      // Notify followers (fire-and-forget)
      ;(async () => {
        const { data: followers } = await supabase
          .from('follows').select('follower_id').eq('provider_id', user!.id)
        if (!followers?.length) return
        const authorName = form.contact_name.trim() || '用户'
        const results = await Promise.allSettled(
          followers.map((row: { follower_id: string }) =>
            notifyFollowerNewListing({
              recipientUserId: row.follower_id,
              authorName,
              contentType: 'job',
              title: form.title.trim(),
              contentId: data.id,
            })
          )
        )
        const failed = results.filter(r => r.status === 'rejected').length
        if (failed > 0) console.warn(`[notify] ${failed}/${followers.length} job notifications failed`)
      })()
    }
    setDone(true)
  }

  if (done) {
    return (
      <PostFormSuccess
        title={isHiring ? '职位已发布！' : '求职帖已发布！'}
        subtitle={isHiring ? '求职者可以联系您了' : '雇主可以联系您了'}
        viewListLabel="查看列表"
        onViewList={() => navigate('/jobs')}
        postAnotherLabel="继续发布"
        onPostAnother={() => { setForm({ ...INITIAL, listing_type: form.listing_type }); setDone(false) }}
      />
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

          <Field label={isHiring ? '工作地区' : '可服务地区'} required error={errors.area}>
            <PostFormAreaPicker
              selected={form.area}
              onChange={(areas) => set('area', areas)}
            />
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

        <PostFormContact
          name={form.contact_name}
          phone={form.contact_phone}
          wechat={form.contact_wechat}
          onNameChange={(v) => set('contact_name', v)}
          onPhoneChange={(v) => set('contact_phone', v)}
          onWechatChange={(v) => set('contact_wechat', v)}
          nameError={errors.contact_name}
          phoneError={errors.contact_phone}
          showLocation
          onLocationChange={setLocation}
        />

        {/* Submit */}
        {submitError && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-2">
            {submitError}
          </div>
        )}
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

