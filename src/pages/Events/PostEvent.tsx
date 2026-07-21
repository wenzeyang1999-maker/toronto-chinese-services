// ─── Post Event Page ───────────────────────────────────────────────────────────
// Route: /events/post
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensurePhoneVerified } from '../../lib/requirePhoneVerified'
import PhoneVerifyBanner from '../../components/PhoneVerifyBanner/PhoneVerifyBanner'
import { motion } from 'framer-motion'
import { ChevronLeft, ImagePlus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { reportUploadedImage } from '../../lib/moderateImage'
import { useAuthStore } from '../../store/authStore'
import { useEventsStore } from '../../store/eventsStore'
import PostFormCard from '../../components/PostForm/PostFormCard'
import PostFormField from '../../components/PostForm/PostFormField'
import { postFormInput } from '../../components/PostForm/postFormInput'
import PostFormAreaPicker from '../../components/PostForm/PostFormAreaPicker'
import PostFormContact from '../../components/PostForm/PostFormContact'
import PostFormSuccess from '../../components/PostForm/PostFormSuccess'
import { useImageUpload } from '../../lib/useImageUpload'
import { EVENT_TYPE_CONFIG, type EventType, type Event } from './types'
import { toast } from '../../lib/toast'
import { moderateContent } from '../../hooks/useContentModeration'
import { notifyFollowerNewListing } from '../../lib/notify'

const Card  = PostFormCard
const Field = PostFormField
const input = postFormInput

const MAX_IMAGES = 4

interface FormState {
  event_type:     EventType
  title:          string
  description:    string
  event_date:     string
  event_time:     string
  event_end_time: string
  location_name:  string
  address:        string
  area:           string[]
  is_free:        boolean
  price:          string
  max_attendees:  string
  contact_name:   string
  contact_phone:  string
  contact_wechat: string
}

const INITIAL: FormState = {
  event_type: 'other', title: '', description: '',
  event_date: '', event_time: '', event_end_time: '',
  location_name: '', address: '', area: [],
  is_free: true, price: '', max_attendees: '',
  contact_name: '', contact_phone: '', contact_wechat: '',
}

export default function PostEvent() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const addEvent  = useEventsStore((s) => s.addEvent)

  const [form,        setForm]        = useState<FormState>(INITIAL)
  const {
    images, previews, uploading: uploadingImg, error: imageError,
    handleChange: handleImageChange, remove: removeImage, reset: resetImages,
  } = useImageUpload(MAX_IMAGES)
  const [errors,      setErrors]      = useState<Partial<Record<keyof FormState | 'images', string>>>({})
  const [submitting,  setSubmitting]  = useState(false)
  const [done,        setDone]        = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])

  useEffect(() => {
    if (!user) return
    supabase.rpc('get_my_contact').returns<{ name: string; phone: string; wechat: string }[]>().maybeSingle()
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

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.title.trim())       e.title       = '请填写活动名称'
    if (!form.description.trim()) e.description = '请填写活动详情'
    if (!form.event_date)         e.event_date  = '请选择活动日期'
    if (form.area.length === 0)   e.area        = '请选择至少一个地区'
    if (!form.contact_name.trim())  e.contact_name  = '请填写联系人姓名'
    if (!form.contact_phone.trim()) e.contact_phone = '请填写联系电话'
    if (!form.is_free && form.price && parseFloat(form.price) < 0) {
      e.price = '价格不能为负数'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !validate()) return
    if (!(await ensurePhoneVerified(navigate))) return
    setSubmitError(null)
    setSubmitting(true)

    const modResult = await moderateContent({ title: form.title, description: form.description })
    if (!modResult.pass) {
      toast(`内容审核未通过：${modResult.reason ?? '包含违规内容'}`, 'error')
      setSubmitting(false)
      return
    }

    const imageUrls: string[] = []
    for (const file of images) {
      const path = `events/${user.id}/${Date.now()}-${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('service-images')
        .upload(path, file, { upsert: false })
      if (uploadErr) {
        setSubmitError('图片上传失败，请检查网络后重试')
        setSubmitting(false)
        return
      }
      const { data: urlData } = supabase.storage.from('service-images').getPublicUrl(path)
      imageUrls.push(urlData.publicUrl)
      void reportUploadedImage(file, urlData.publicUrl, 'event')
    }

    const payload = {
      poster_id:      user.id,
      event_type:     form.event_type,
      title:          form.title.trim(),
      description:    form.description.trim(),
      event_date:     form.event_date,
      event_time:     form.event_time || null,
      event_end_time: form.event_end_time || null,
      location_name:  form.location_name.trim() || null,
      address:        form.address.trim() || null,
      area:           form.area.length > 0 ? form.area : null,
      price:          !form.is_free && form.price ? parseFloat(form.price) : null,
      max_attendees:  form.max_attendees ? parseInt(form.max_attendees) : null,
      images:         imageUrls,
      contact_name:   form.contact_name.trim(),
      contact_phone:  form.contact_phone.trim(),
      contact_wechat: form.contact_wechat.trim() || null,
      is_active:      true,
    }

    const { data, error } = await supabase
      .from('events')
      .insert(payload)
      .select('*, poster:users(id, name, avatar_url)')
      .single()
    setSubmitting(false)

    if (error) {
      setSubmitError(/会员|过于频繁|最多|上限/.test(error.message) ? error.message : '发布失败，请稍后重试')
      setSubmitting(false)
      return
    }

    if (data) {
      addEvent({
        ...data,
        images: data.images ?? [],
        poster: Array.isArray(data.poster) ? (data.poster[0] ?? null) : (data.poster ?? null),
      } as Event)

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
              contentType: 'event',
              title: form.title.trim(),
              contentId: data.id,
            })
          )
        )
        const failed = results.filter(r => r.status === 'rejected').length
        if (failed > 0) console.warn(`[notify] ${failed}/${followers.length} event notifications failed`)
      })()
    }
    setDone(true)
  }

  if (done) {
    return (
      <PostFormSuccess
        title="活动已发布！"
        subtitle="感兴趣的人可以联系您了"
        viewListLabel="查看活动列表"
        onViewList={() => navigate('/events')}
        postAnotherLabel="再发一个活动"
        onPostAnother={() => { setDone(false); setForm(INITIAL); resetImages() }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800">发布活动</span>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-4 space-y-4">
        <PhoneVerifyBanner />

        {/* Event type */}
        <Card title="活动类型">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((t) => {
              const cfg = EVENT_TYPE_CONFIG[t]
              return (
                <button key={t} type="button" onClick={() => set('event_type', t)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border transition-colors ${
                    form.event_type === t
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {cfg.emoji} {cfg.label}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Activity images */}
        <Card title={`活动图片（最多 ${MAX_IMAGES} 张）`}>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                <img loading="lazy" src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-gray-900/60 rounded-full
                             flex items-center justify-center text-white hover:bg-red-500 transition-colors">
                  <X size={11} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingImg}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300
                           flex flex-col items-center justify-center gap-1
                           text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors">
                <ImagePlus size={20} />
                <span className="text-[10px]">添加图片</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={handleImageChange} />
          {imageError && <p className="text-xs text-red-500 mt-1">{imageError}</p>}
        </Card>

        {/* Basic info */}
        <Card title="基本信息">
          <Field label="活动名称" required error={errors.title}>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="例：北约克中秋联欢晚会" className={input(!!errors.title)} />
          </Field>

          <Field label="活动详情" required error={errors.description}>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={5} placeholder="请详细描述活动内容、流程、注意事项等…"
              className={input(!!errors.description) + ' resize-none'} />
          </Field>
        </Card>

        {/* Date & Time */}
        <Card title="时间">
          <Field label="活动日期" required error={errors.event_date}>
            <input type="date" value={form.event_date} onChange={(e) => set('event_date', e.target.value)}
              className={input(!!errors.event_date)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="开始时间（选填）">
              <input type="time" value={form.event_time} onChange={(e) => set('event_time', e.target.value)}
                className={input(false)} />
            </Field>
            <Field label="结束时间（选填）">
              <input type="time" value={form.event_end_time} onChange={(e) => set('event_end_time', e.target.value)}
                className={input(false)} />
            </Field>
          </div>
        </Card>

        {/* Location */}
        <Card title="地点">
          <Field label="场馆名称（选填）">
            <input value={form.location_name} onChange={(e) => set('location_name', e.target.value)}
              placeholder="例：多伦多市政厅、Scarborough Civic Centre"
              className={input(false)} />
          </Field>

          <Field label="详细地址（选填）">
            <input value={form.address} onChange={(e) => set('address', e.target.value)}
              placeholder="例：100 Queen St W, Toronto"
              className={input(false)} />
          </Field>

          <Field label="所在地区" required error={errors.area}>
            <PostFormAreaPicker selected={form.area} onChange={(areas) => set('area', areas)} error={errors.area} />
          </Field>
        </Card>

        {/* Price & Capacity */}
        <Card title="费用与名额">
          <Field label="活动费用">
            <div className="flex gap-2 mb-2">
              <button type="button"
                onClick={() => set('is_free', true)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  form.is_free ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                免费活动
              </button>
              <button type="button"
                onClick={() => set('is_free', false)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  !form.is_free ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                付费活动
              </button>
            </div>
            {!form.is_free && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 text-sm">$</span>
                <input type="number" min="0" value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  placeholder="0"
                  className={input(!!errors.price) + ' flex-1'} />
              </div>
            )}
            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
          </Field>

          <Field label="名额上限（选填）">
            <input type="number" min="1" value={form.max_attendees}
              onChange={(e) => set('max_attendees', e.target.value)}
              placeholder="不填则不限名额"
              className={input(false)} />
          </Field>
        </Card>

        {/* Contact */}
        <PostFormContact
          name={form.contact_name} phone={form.contact_phone} wechat={form.contact_wechat}
          onNameChange={(v) => set('contact_name', v)}
          onPhoneChange={(v) => set('contact_phone', v)}
          onWechatChange={(v) => set('contact_wechat', v)}
          nameError={errors.contact_name} phoneError={errors.contact_phone}
        />

        {submitError && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-2">
            {submitError}
          </div>
        )}
        <motion.button type="submit" disabled={submitting || uploadingImg}
          whileTap={{ scale: submitting ? 1 : 0.97 }}
          className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold text-base
                     hover:bg-primary-700 active:scale-95 transition-all
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? '发布中…' : uploadingImg ? '图片上传中…' : '发布活动'}
        </motion.button>

        <p className="text-center text-xs text-gray-400 pb-8">发布即代表同意平台使用条款</p>
      </form>
    </div>
  )
}
