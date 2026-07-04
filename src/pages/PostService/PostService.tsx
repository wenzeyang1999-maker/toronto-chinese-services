import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensurePhoneVerified } from '../../lib/requirePhoneVerified'
import PhoneVerifyBanner from '../../components/PhoneVerifyBanner/PhoneVerifyBanner'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { moderateContent } from '../../hooks/useContentModeration'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import type { PostServiceForm } from '../../types'
import Header from '../../components/Header/Header'
import { compressImage, validateImageFile } from '../../lib/compressImage'
import type { LocationResult } from '../../components/LocationInput/LocationInput'
import { generateServiceDraft } from '../../lib/aiTools'
import { notifyFollowerNewService } from '../../lib/notify'
import { toast } from '../../lib/toast'
import { BUILTIN_SERVICES, type ServiceSuggestion } from './data/constants'
import Field from './components/Field'
import SuccessScreen from './components/SuccessScreen'
import CategoryPicker from './components/CategoryPicker'
import ImageUpload from './components/ImageUpload'
import AreaPicker from './components/AreaPicker'
import ContactSection from './components/ContactSection'

const INITIAL_FORM: PostServiceForm = {
  category: 'moving',
  title: '',
  description: '',
  price: '',
  priceType: 'hourly',
  name: '',
  phone: '',
  wechat: '',
  address: '',
  area: 'North York',
  tags: '',
}

export default function PostService() {
  const navigate       = useNavigate()
  const fetchServices  = useAppStore((s) => s.fetchServices)
  const user           = useAuthStore((s) => s.user)

  const [form, setForm]                 = useState<PostServiceForm>(INITIAL_FORM)
  const [confirmedCustom, setConfirmedCustom] = useState('')
  const [location, setLocation]         = useState<LocationResult | null>(null)
  const [submitted, setSubmitted]       = useState(false)
  const [newServiceId, setNewServiceId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [errors, setErrors]             = useState<Partial<PostServiceForm>>({})
  const [aiKeywords, setAiKeywords]     = useState('')
  const [images, setImages]             = useState<File[]>([])
  const [previews, setPreviews]         = useState<string[]>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [dbServices, setDbServices]     = useState<ServiceSuggestion[]>([])

  const serviceInfoRef = useRef<HTMLDivElement>(null)
  const contactRef     = useRef<HTMLDivElement>(null)
  const areaRef        = useRef<HTMLDivElement>(null)

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)

  // Auto-fill contact from saved profile
  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name, phone, wechat').eq('id', user.id).single()
      .then(({ data }) => {
        if (!data) return
        setForm(prev => ({
          ...prev,
          name:   data.name  || prev.name,
          phone:  data.phone || prev.phone,
          wechat: data.wechat || prev.wechat || '',
        }))
      })
  }, [user])

  // Load crowd-sourced service types
  useEffect(() => {
    supabase.from('service_types').select('name, category_id').order('usage_count', { ascending: false }).limit(200)
      .then(({ data }) => {
        if (data) {
          setDbServices(data.map(r => ({
            name: r.name,
            category: (r.category_id ?? 'other') as ServiceSuggestion['category'],
            tags: [r.name],
          })))
        }
      })
  }, [])

  // Revoke blob URLs on unmount
  useEffect(() => () => { previews.forEach(url => URL.revokeObjectURL(url)) }, [])

  const ALL_SERVICES = [
    ...BUILTIN_SERVICES,
    ...dbServices.filter(d => !BUILTIN_SERVICES.some(b => b.name === d.name)),
  ]

  const update = (field: keyof PostServiceForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const invalid = files.map(validateImageFile).filter(Boolean)
    if (invalid.length > 0) { toast(invalid[0] ?? '图片格式不支持', 'error'); e.target.value = ''; return }
    const toAdd = files.slice(0, 3 - images.length)
    setImages((prev) => [...prev, ...toAdd])
    setPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const handleImageRemove = (index: number) => {
    URL.revokeObjectURL(previews[index])
    setImages((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const validate = () => {
    const errs: Partial<PostServiceForm> = {}
    if (!form.title.trim()) errs.title = '请填写服务标题'
    if (!form.description.trim()) errs.description = '请填写服务描述'
    if (!form.price.trim() && form.priceType !== 'negotiable') errs.price = '请填写价格'
    if (!form.name.trim()) errs.name = '请填写联系人姓名'
    if (!form.phone.trim()) {
      errs.phone = '请填写联系电话'
    } else if (!/^[\d\s\-+().]{7,20}$/.test(form.phone.trim())) {
      errs.phone = '请输入有效的电话号码（如：647-xxx-xxxx）'
    }
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      // Scroll to the section holding the first error so the user isn't left
      // staring at a submit button that "did nothing".
      const ref =
        (errs.title || errs.description || errs.price) ? serviceInfoRef :
        (errs.name || errs.phone)                      ? contactRef :
        errs.area                                      ? areaRef : null
      if (ref) scrollTo(ref)
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!user) { navigate('/login'); return }
    if (!(await ensurePhoneVerified(navigate))) return

    setIsSubmitting(true)
    setSubmitError('')
    try {
      // 0. Content moderation
      const modResult = await moderateContent({ title: form.title, description: form.description, tags: form.tags })
      if (!modResult.pass) {
        setSubmitError(`内容审核未通过：${modResult.reason ?? '包含违规内容'}。请修改后重新发布。`)
        setIsSubmitting(false)
        return
      }

      // 1. Update user contact info
      const { error: upsertError } = await supabase.from('users').update({
        name: form.name.trim(), phone: form.phone.trim(), wechat: form.wechat?.trim() || null,
      }).eq('id', user.id)
      if (upsertError) throw upsertError

      // 2. Upload images — in parallel (each path has a random suffix, so no
      //    collision). Order is preserved by Promise.all; failures are collected.
      const uploadResults = await Promise.all(images.map(async (file) => {
        const compressed = await compressImage(file)
        const ext = compressed.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage.from('service-images').upload(path, compressed, { upsert: false })
        if (uploadError) return { ok: false as const, name: file.name }
        const { data: { publicUrl } } = supabase.storage.from('service-images').getPublicUrl(path)
        return { ok: true as const, url: publicUrl }
      }))
      const imageUrls          = uploadResults.flatMap((r) => (r.ok ? [r.url] : []))
      const imageUploadErrors  = uploadResults.flatMap((r) => (r.ok ? [] : [r.name]))

      const baseTags = form.tags ? form.tags.split(/[,，\s]+/).filter(Boolean) : []
      const allTags  = confirmedCustom ? [...baseTags, `类型:${confirmedCustom}`] : baseTags
      const areaDisplay = selectedAreas.join('、') || 'Toronto'

      // 3. Insert service
      const { data: insertedService, error } = await supabase.from('services').insert({
        category_id:   form.category,
        title:         form.title.trim(),
        description:   form.description.trim(),
        price:         form.priceType === 'negotiable' ? 0 : parseFloat(form.price) || 0,
        price_type:    form.priceType,
        address:       location?.address ?? null,
        lat:           (location?.lat != null && location?.lng != null && !(location.lat === 0 && location.lng === 0)) ? location.lat : null,
        lng:           (location?.lat != null && location?.lng != null && !(location.lat === 0 && location.lng === 0)) ? location.lng : null,
        area:          areaDisplay,
        service_areas: selectedAreas.length > 0 ? selectedAreas : ['Toronto'],
        city:          'Toronto',
        provider_id:   user.id,
        tags:          allTags,
        images:        imageUrls,
        is_available:  true,
        is_verified:   false,
      }).select('id').single()
      if (error) throw error

      // 4. Save service type for crowd-sourcing
      const serviceTypeName = confirmedCustom || form.title.trim()
      if (serviceTypeName) {
        await supabase.from('service_types').upsert(
          { name: serviceTypeName, category_id: form.category, usage_count: 1 },
          { onConflict: 'name', ignoreDuplicates: true }
        )
      }

      // 5. Notify followers
      const { data: followers } = await supabase.from('follows').select('follower_id').eq('provider_id', user.id)
      if (insertedService?.id && followers?.length) {
        await Promise.all(
          followers.map((row: { follower_id: string }) =>
            notifyFollowerNewService({
              recipientUserId: row.follower_id,
              providerName:    form.name.trim(),
              serviceTitle:    form.title.trim(),
              serviceId:       insertedService.id,
            })
          )
        )
      }

      if (imageUploadErrors.length > 0) {
        setSubmitError(`服务已发布，但部分图片（${imageUploadErrors.join('、')}）上传失败，请稍后在"我的服务"中重新上传图片`)
        return
      }

      await fetchServices()
      setNewServiceId(insertedService?.id ?? null)
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err?.message ?? '发布失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <SuccessScreen
        newServiceId={newServiceId}
        onGoHome={() => navigate('/')}
        onContinue={() => {
          previews.forEach(url => URL.revokeObjectURL(url))
          setForm(INITIAL_FORM)
          setImages([])
          setPreviews([])
          setSelectedAreas([])
          setConfirmedCustom('')
          setSubmitted(false)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">发布服务</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
        <PhoneVerifyBanner />
          {/* ── Category picker ───────────────────────────────────────────────── */}
          <CategoryPicker
            value={form.category}
            confirmedCustom={confirmedCustom}
            allServices={ALL_SERVICES}
            onCategoryChange={(cat) => update('category', cat)}
            onConfirmedCustomChange={setConfirmedCustom}
            onProceed={() => scrollTo(serviceInfoRef)}
          />

          {/* ── Service info ──────────────────────────────────────────────────── */}
          <div ref={serviceInfoRef} className="card p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-700">服务信息</h3>
              <button
                type="button"
                onClick={async () => {
                  setAiGenerating(true)
                  const draft = await generateServiceDraft({
                    categoryId:   form.category,
                    title:        form.title,
                    keywords:     `${aiKeywords}\n${form.tags}`.trim(),
                    serviceAreas: selectedAreas,
                    priceType:    form.priceType,
                    imageCount:   images.length,
                  })
                  setAiGenerating(false)
                  if (!draft) { setSubmitError('AI 文案生成失败，请稍后再试'); return }
                  setForm((prev) => ({
                    ...prev,
                    title:       draft.title || prev.title,
                    description: draft.description || prev.description,
                    tags:        draft.tags.length ? draft.tags.join(' ') : prev.tags,
                  }))
                }}
                disabled={aiGenerating}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 disabled:opacity-60 transition-colors"
              >
                {aiGenerating && (
                  <span className="w-3 h-3 border-2 border-primary-300 border-t-transparent rounded-full animate-spin" />
                )}
                {aiGenerating ? 'AI 生成中…' : 'AI 辅助写文案'}
              </button>
            </div>

            <Field label="AI 关键词">
              <input
                className="input-base"
                value={aiKeywords}
                onChange={(e) => setAiKeywords(e.target.value)}
                placeholder="例：家里漏水、北约克、10年经验、可上门急修"
              />
              <p className="text-xs text-gray-400 mt-1">可结合已选图片数量、分类和区域生成更自然的服务标题与描述</p>
            </Field>

            <Field label="服务标题" required error={errors.title}>
              <input
                className="input-base"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="例：多伦多本地搬家服务，有货车"
                maxLength={50}
              />
            </Field>

            <Field label="服务描述" required error={errors.description}>
              <textarea
                className="input-base resize-none"
                rows={4}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="详细描述您的服务内容、经验、注意事项等..."
                maxLength={500}
              />
              <p className="text-xs text-gray-400 text-right mt-0.5">{form.description.length}/500</p>
            </Field>

            <ImageUpload
              previews={previews}
              count={images.length}
              onAdd={handleImageAdd}
              onRemove={handleImageRemove}
            />

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">价格 *</label>
              <div className="flex gap-2">
                <div className="flex rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                  {[
                    { v: 'hourly', l: '时薪' },
                    { v: 'fixed',  l: '固定价' },
                    { v: 'negotiable', l: '面议' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => update('priceType', opt.v)}
                      className={`px-3 py-2 text-xs font-medium transition-colors ${
                        form.priceType === opt.v
                          ? 'bg-primary-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                {form.priceType !== 'negotiable' && (
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      className="input-base pl-7"
                      value={form.price}
                      onChange={(e) => update('price', e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      type="number"
                      min="0"
                    />
                  </div>
                )}
              </div>
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
            </div>

            <Field label="标签（用逗号分隔）">
              <input
                className="input-base"
                value={form.tags}
                onChange={(e) => update('tags', e.target.value)}
                onBlur={() => scrollTo(contactRef)}
                placeholder="例：本地搬家, 打包服务, 有货车"
              />
            </Field>
          </div>

          {/* ── Contact ───────────────────────────────────────────────────────── */}
          <div ref={contactRef}>
            <ContactSection
              name={form.name}
              phone={form.phone}
              wechat={form.wechat}
              errors={{ name: errors.name, phone: errors.phone }}
              onChange={(field, value) => update(field, value)}
              onLocationChange={setLocation}
              onProceed={() => scrollTo(areaRef)}
            />
          </div>

          {/* ── Area picker ───────────────────────────────────────────────────── */}
          <div ref={areaRef}>
            <AreaPicker selectedAreas={selectedAreas} onChange={setSelectedAreas} />
          </div>

          {submitError && (
            <p className="text-sm text-red-500 text-center">{submitError}</p>
          )}

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileTap={{ scale: isSubmitting ? 1 : 0.97 }}
            className="w-full btn-primary py-4 text-base rounded-2xl disabled:opacity-60"
          >
            {isSubmitting ? '发布中...' : '免费发布服务'}
          </motion.button>

          <p className="text-xs text-center text-gray-400">
            发布即表示您同意平台服务条款，内容须合法合规
          </p>
        </form>
      </div>
    </div>
  )
}
