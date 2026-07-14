// ─── Post Secondhand Listing Page ────────────────────────────────────────────
// Route: /secondhand/post
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensurePhoneVerified } from '../../lib/requirePhoneVerified'
import PhoneVerifyBanner from '../../components/PhoneVerifyBanner/PhoneVerifyBanner'
import { motion } from 'framer-motion'
import { ChevronLeft, ImagePlus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useSecondhandStore } from '../../store/secondhandStore'
import PostFormCard from '../../components/PostForm/PostFormCard'
import PostFormField from '../../components/PostForm/PostFormField'
import { postFormInput } from '../../components/PostForm/postFormInput'
import PostFormAreaPicker from '../../components/PostForm/PostFormAreaPicker'
import PostFormContact from '../../components/PostForm/PostFormContact'
import PostFormSuccess from '../../components/PostForm/PostFormSuccess'
import type { LocationResult } from '../../components/LocationInput/LocationInput'
import { useImageUpload } from '../../lib/useImageUpload'
import {
  SECONDHAND_CATEGORY_CONFIG, ITEM_CONDITION_CONFIG,
  type SecondhandCategory, type ItemCondition, type SecondhandItem,
} from './types'
import { toast } from '../../lib/toast'
import { moderateContent } from '../../hooks/useContentModeration'
import { notifyFollowerNewListing } from '../../lib/notify'

const Card  = PostFormCard
const Field = PostFormField
const input = postFormInput

const MAX_IMAGES = 4

interface FormState {
  title: string
  category: SecondhandCategory
  condition: ItemCondition
  description: string
  price: string
  is_free: boolean
  area: string[]
  contact_name: string
  contact_phone: string
  contact_wechat: string
}

const INITIAL: FormState = {
  title: '', category: 'other', condition: 'good', description: '',
  price: '', is_free: false,
  area: [], contact_name: '', contact_phone: '', contact_wechat: '',
}

export default function PostListing() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const addItem  = useSecondhandStore((s) => s.addItem)

  const [form,        setForm]        = useState<FormState>(INITIAL)
  const [location,    setLocation]    = useState<LocationResult | null>(null)
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

  // Pre-fill contact from profile
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
    if (!form.title.trim())         e.title         = '请填写标题'
    if (!form.description.trim())   e.description   = '请描述物品状态'
    if (form.area.length === 0)     e.area          = '请选择至少一个交易地区'
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

    // Upload images
    const imageUrls: string[] = []
    for (const file of images) {
      const path = `secondhand/${user.id}/${Date.now()}-${file.name}`
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
    }

    const payload = {
      seller_id:      user.id,
      title:          form.title.trim(),
      category:       form.category,
      condition:      form.condition,
      description:    form.description.trim(),
      price:          !form.is_free && form.price ? parseFloat(form.price) : null,
      is_free:        form.is_free,
      images:         imageUrls,
      area:           form.area.length > 0 ? form.area : null,
      city:           'Toronto',
      contact_name:   form.contact_name.trim(),
      contact_phone:  form.contact_phone.trim(),
      contact_wechat: form.contact_wechat.trim() || null,
      is_active:      true,
      is_sold:        false,
      address:        location?.address ?? null,
      lat:            (location?.lat != null && location?.lng != null && !(location.lat === 0 && location.lng === 0)) ? location.lat : null,
      lng:            (location?.lat != null && location?.lng != null && !(location.lat === 0 && location.lng === 0)) ? location.lng : null,
    }

    const { data, error } = await supabase
      .from('secondhand')
      .insert(payload)
      .select('*, seller:users(id, name, avatar_url)')
      .single()
    setSubmitting(false)

    if (error) {
      setSubmitError(/会员|过于频繁|最多|上限/.test(error.message) ? error.message : '发布失败，请稍后重试')
      setSubmitting(false)
      return
    }

    if (data) {
      addItem({
        ...data,
        images: data.images ?? [],
        seller: Array.isArray(data.seller) ? (data.seller[0] ?? null) : (data.seller ?? null),
      } as SecondhandItem)

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
              contentType: 'secondhand',
              title: form.title.trim(),
              contentId: data.id,
            })
          )
        )
        const failed = results.filter(r => r.status === 'rejected').length
        if (failed > 0) console.warn(`[notify] ${failed}/${followers.length} secondhand notifications failed`)
      })()
    }
    setDone(true)
  }

  if (done) {
    return (
      <PostFormSuccess
        title="闲置已发布！"
        subtitle="买家可以联系您了"
        viewListLabel="查看二手列表"
        onViewList={() => navigate('/secondhand')}
        postAnotherLabel="继续发布"
        onPostAnother={() => { resetImages(); setForm(INITIAL); setDone(false) }}
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
        <span className="font-semibold text-gray-800">发布闲置</span>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <PhoneVerifyBanner />

        {/* ── 图片 ─────────────────────────────────────────────────────────── */}
        <Card title={`物品图片（最多 ${MAX_IMAGES} 张）`}>
          <div className="flex flex-wrap gap-2">
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
              <button type="button" onClick={() => fileRef.current?.click()}
                disabled={uploadingImg}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300
                           flex flex-col items-center justify-center gap-1
                           text-gray-400 hover:border-primary-400 hover:text-primary-500
                           transition-colors disabled:opacity-50">
                <ImagePlus size={20} />
                <span className="text-[10px]">{uploadingImg ? '处理中…' : '添加图片'}</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={handleImageChange} />
          {imageError && <p className="text-xs text-red-500 mt-1">{imageError}</p>}
          <p className="text-xs text-gray-400 mt-1">建议上传清晰实物照，首张图作为封面</p>
        </Card>

        {/* ── 基本信息 ─────────────────────────────────────────────────────── */}
        <Card title="基本信息">
          <Field label="标题" required error={errors.title}>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="例：iPhone 14 Pro 256G 黑色"
              className={input(!!errors.title)} />
          </Field>

          {/* Category */}
          <Field label="分类" required>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SECONDHAND_CATEGORY_CONFIG) as SecondhandCategory[]).map((k) => (
                <button key={k} type="button" onClick={() => set('category', k)}
                  className={`text-sm px-3 py-1.5 rounded-xl border transition-colors ${
                    form.category === k
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {SECONDHAND_CATEGORY_CONFIG[k].emoji} {SECONDHAND_CATEGORY_CONFIG[k].label}
                </button>
              ))}
            </div>
          </Field>

          {/* Condition */}
          <Field label="成色" required>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ITEM_CONDITION_CONFIG) as ItemCondition[]).map((k) => (
                <button key={k} type="button" onClick={() => set('condition', k)}
                  className={`text-sm px-4 py-1.5 rounded-xl border transition-colors ${
                    form.condition === k
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {ITEM_CONDITION_CONFIG[k].label}
                </button>
              ))}
            </div>
          </Field>

          {/* Area multi-select */}
          <Field label="交易地区" required error={errors.area}>
            <PostFormAreaPicker selected={form.area} onChange={(areas) => set('area', areas)} error={errors.area} />
          </Field>
        </Card>

        {/* ── 价格 ─────────────────────────────────────────────────────────── */}
        <Card title="价格">
          <div className="flex items-center gap-3 mb-3">
            <button type="button" onClick={() => set('is_free', false)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                !form.is_free ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              设定价格
            </button>
            <button type="button" onClick={() => { set('is_free', true); set('price', '') }}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                form.is_free ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              免费赠送
            </button>
          </div>
          {!form.is_free && (
            <Field label="价格（CAD）" error={errors.price}>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  placeholder="0.00（留空表示面议）"
                  className={`${input(!!errors.price)} flex-1`} />
              </div>
            </Field>
          )}
        </Card>

        {/* ── 描述 ─────────────────────────────────────────────────────────── */}
        <Card title="物品详情">
          <Field label="物品描述" required error={errors.description}>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={5} placeholder="描述物品的状态、使用情况、附件等…"
              className={input(!!errors.description) + ' resize-none'} />
          </Field>
        </Card>

        {/* ── 联系方式 ─────────────────────────────────────────────────────── */}
        <PostFormContact
          name={form.contact_name} phone={form.contact_phone} wechat={form.contact_wechat}
          onNameChange={(v) => set('contact_name', v)}
          onPhoneChange={(v) => set('contact_phone', v)}
          onWechatChange={(v) => set('contact_wechat', v)}
          nameError={errors.contact_name} phoneError={errors.contact_phone}
          showLocation onLocationChange={setLocation}
        />

        {/* Submit */}
        {submitError && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-2">
            {submitError}
          </div>
        )}
        <motion.button
          type="submit"
          disabled={submitting || uploadingImg}
          whileTap={{ scale: submitting ? 1 : 0.97 }}
          className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold text-base
                     hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? '发布中…' : '发布闲置'}
        </motion.button>

        <div className="h-4" />
      </form>
    </div>
  )
}

