// ─── Post Property Page ───────────────────────────────────────────────────────
// Route: /realestate/post
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ensurePhoneVerified } from '../../lib/requirePhoneVerified'
import PhoneVerifyBanner from '../../components/PhoneVerifyBanner/PhoneVerifyBanner'
import { motion } from 'framer-motion'
import { ChevronLeft, ImagePlus, X } from 'lucide-react'
import PostFormCard from '../../components/PostForm/PostFormCard'
import PostFormField from '../../components/PostForm/PostFormField'
import { postFormInput } from '../../components/PostForm/postFormInput'
import PostFormAreaPicker from '../../components/PostForm/PostFormAreaPicker'
import PostFormContact from '../../components/PostForm/PostFormContact'
import LocationInput, { type LocationResult } from '../../components/LocationInput/LocationInput'
import PostFormSuccess from '../../components/PostForm/PostFormSuccess'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useRealEstateStore } from '../../store/realestateStore'
import { useImageUpload } from '../../lib/useImageUpload'
import {
  LISTING_TYPE_CONFIG, PROPERTY_TYPE_CONFIG, PRICE_TYPE_LABEL,
  type RealEstateListingType, type PropertyType, type PriceType, type Property,
} from './types'
import { toast } from '../../lib/toast'
import { moderateContent } from '../../hooks/useContentModeration'
import { notifyFollowerNewListing } from '../../lib/notify'

const Card  = PostFormCard
const Field = PostFormField
const input = postFormInput

const MAX_IMAGES = 6

interface FormState {
  listing_type: RealEstateListingType
  title: string
  property_type: PropertyType
  bedrooms: string
  bathrooms: string
  sqft: string
  description: string
  price: string
  price_type: PriceType
  pet_friendly: boolean
  parking: boolean
  utilities_included: boolean
  area: string[]
  address: string
  available_date: string
  contact_name: string
  contact_phone: string
  contact_wechat: string
}

const INITIAL: FormState = {
  listing_type: 'rent',
  title: '', property_type: 'apartment',
  bedrooms: '', bathrooms: '', sqft: '',
  description: '', price: '', price_type: 'monthly',
  pet_friendly: false, parking: false, utilities_included: false,
  area: [], address: '', available_date: '',
  contact_name: '', contact_phone: '', contact_wechat: '',
}

export default function PostProperty() {
  const navigate      = useNavigate()
  const [searchParams] = useSearchParams()
  const user          = useAuthStore((s) => s.user)
  const addProperty   = useRealEstateStore((s) => s.addProperty)

  const initType = (searchParams.get('type') ?? 'rent') as RealEstateListingType
  const [form,         setForm]        = useState<FormState>({ ...INITIAL, listing_type: initType })
  const [location,     setLocation]    = useState<LocationResult | null>(null)
  const {
    images, previews, uploading: uploadingImg, error: imageError,
    handleChange: handleImageChange, remove: removeImage, reset: resetImages,
  } = useImageUpload(MAX_IMAGES)
  const [errors,       setErrors]      = useState<Partial<Record<keyof FormState | 'images', string>>>({})
  const [submitting,   setSubmitting]  = useState(false)
  const [done,         setDone]        = useState(false)
  const [submitError,  setSubmitError] = useState<string | null>(null)
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
    if (!form.title.trim())         e.title         = '请填写标题'
    if (!form.description.trim())   e.description   = '请描述房源'
    if (form.area.length === 0)     e.area          = '请选择至少一个地区'
    if (!form.contact_name.trim())  e.contact_name  = '请填写联系人姓名'
    if (!form.contact_phone.trim()) e.contact_phone = '请填写联系电话'
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
      const path = `realestate/${user.id}/${Date.now()}-${file.name}`
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
      poster_id:          user.id,
      listing_type:       form.listing_type,
      title:              form.title.trim(),
      property_type:      form.property_type,
      bedrooms:           form.bedrooms !== '' ? parseInt(form.bedrooms) : null,
      bathrooms:          form.bathrooms !== '' ? parseFloat(form.bathrooms) : null,
      sqft:               form.sqft !== '' ? parseInt(form.sqft) : null,
      description:        form.description.trim(),
      price:              form.price_type !== 'negotiable' && form.price ? parseFloat(form.price) : null,
      price_type:         form.price_type,
      pet_friendly:       form.pet_friendly,
      parking:            form.parking,
      utilities_included: form.utilities_included,
      images:             imageUrls,
      area:               form.area.length > 0 ? form.area : null,
      city:               'Toronto',
      address:            location?.address ?? (form.address.trim() || null),
      lat:                (location && !(location.lat === 0 && location.lng === 0)) ? location.lat : null,
      lng:                (location && !(location.lat === 0 && location.lng === 0)) ? location.lng : null,
      available_date:     form.available_date || null,
      contact_name:       form.contact_name.trim(),
      contact_phone:      form.contact_phone.trim(),
      contact_wechat:     form.contact_wechat.trim() || null,
      is_active:          true,
    }

    const { data, error } = await supabase
      .from('properties')
      .insert(payload)
      .select('*, poster:users(id, name, avatar_url)')
      .single()
    setSubmitting(false)

    if (error) { setSubmitError(/会员|过于频繁|最多|上限/.test(error.message) ? error.message : '发布失败，请稍后重试'); setSubmitting(false); return }

    if (data) {
      addProperty({
        ...data,
        images: data.images ?? [],
        poster: Array.isArray(data.poster) ? (data.poster[0] ?? null) : (data.poster ?? null),
      } as Property)

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
              contentType: 'property',
              title: form.title.trim(),
              contentId: data.id,
            })
          )
        )
        const failed = results.filter(r => r.status === 'rejected').length
        if (failed > 0) console.warn(`[notify] ${failed}/${followers.length} property notifications failed`)
      })()
    }
    setDone(true)
  }

  if (done) {
    return (
      <PostFormSuccess
        title="房源已发布！"
        subtitle="租客 / 买家可以联系您了"
        viewListLabel="查看房源列表"
        onViewList={() => navigate('/realestate')}
        postAnotherLabel="继续发布"
        onPostAnother={() => { resetImages(); setForm(INITIAL); setLocation(null); setDone(false) }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800">发布房源</span>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <PhoneVerifyBanner />

        {/* ── 出租/出售/合租 ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex gap-1">
          {(Object.keys(LISTING_TYPE_CONFIG) as RealEstateListingType[]).map((t) => (
            <button key={t} type="button" onClick={() => set('listing_type', t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                form.listing_type === t
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {LISTING_TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>

        {/* ── 图片 ─────────────────────────────────────────────────────────── */}
        <Card title={`房源图片（最多 ${MAX_IMAGES} 张）`}>
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
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingImg}
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
        </Card>

        {/* ── 基本信息 ─────────────────────────────────────────────────────── */}
        <Card title="基本信息">
          <Field label="标题" required error={errors.title}>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="例：北约克2卧1卫公寓出租，近地铁"
              className={input(!!errors.title)} />
          </Field>

          <Field label="房屋类型" required>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PROPERTY_TYPE_CONFIG) as PropertyType[]).map((k) => (
                <button key={k} type="button" onClick={() => set('property_type', k)}
                  className={`text-sm px-3 py-1.5 rounded-xl border transition-colors ${
                    form.property_type === k
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {PROPERTY_TYPE_CONFIG[k].emoji} {PROPERTY_TYPE_CONFIG[k].label}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex gap-3">
            <Field label="卧室数" className="flex-1">
              <select value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)}
                className={input(false)}>
                <option value="">不指定</option>
                <option value="0">Studio</option>
                <option value="1">1 卧</option>
                <option value="2">2 卧</option>
                <option value="3">3 卧</option>
                <option value="4">4 卧+</option>
              </select>
            </Field>
            <Field label="卫生间数" className="flex-1">
              <select value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)}
                className={input(false)}>
                <option value="">不指定</option>
                <option value="1">1 卫</option>
                <option value="1.5">1.5 卫</option>
                <option value="2">2 卫</option>
                <option value="2.5">2.5 卫</option>
                <option value="3">3 卫+</option>
              </select>
            </Field>
          </div>

          <Field label="室内面积（平方英尺，选填）">
            <input type="number" inputMode="numeric" min={0} value={form.sqft}
              onChange={(e) => set('sqft', e.target.value)}
              placeholder="例：750" className={input(false)} />
          </Field>

          {/* Area */}
          <Field label="地区" required error={errors.area}>
            <PostFormAreaPicker selected={form.area} onChange={(areas) => set('area', areas)} error={errors.area} />
          </Field>

          <Field label="详细地址（选填）">
            <input value={form.address} onChange={(e) => set('address', e.target.value)}
              placeholder="例：Jane & Finch 附近，无需填写门牌号"
              className={input(false)} />
          </Field>

          <Field label="地图定位（选填，方便租客在地图上找到）">
            <LocationInput onChange={setLocation} />
          </Field>

          <Field label="可入住日期（选填）">
            <input type="date" value={form.available_date}
              onChange={(e) => set('available_date', e.target.value)}
              className={input(false)} />
          </Field>
        </Card>

        {/* ── 价格 ─────────────────────────────────────────────────────────── */}
        <Card title="价格">
          <Field label="计价方式" required>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRICE_TYPE_LABEL) as PriceType[]).map((k) => (
                <button key={k} type="button" onClick={() => set('price_type', k)}
                  className={`text-sm px-4 py-1.5 rounded-xl border transition-colors ${
                    form.price_type === k
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {k === 'negotiable' ? '价格面议' : k === 'monthly' ? '月租' : '总价'}
                </button>
              ))}
            </div>
          </Field>
          {form.price_type !== 'negotiable' && (
            <Field label={form.price_type === 'monthly' ? '月租金（CAD）' : '售价（CAD）'}>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 text-sm">$</span>
                <input type="number" min="0" value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  placeholder="0"
                  className={`${input(false)} flex-1`} />
              </div>
            </Field>
          )}
        </Card>

        {/* ── 配套设施 ─────────────────────────────────────────────────────── */}
        <Card title="配套设施">
          <div className="flex flex-wrap gap-3">
            {([
              { key: 'pet_friendly' as const, label: '可养宠物', emoji: '🐾' },
              { key: 'parking' as const, label: '含停车位', emoji: '🚗' },
              { key: 'utilities_included' as const, label: '含水电网', emoji: '⚡' },
            ]).map(({ key, label, emoji }) => (
              <button key={key} type="button" onClick={() => set(key, !form[key])}
                className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-colors ${
                  form[key]
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                }`}
              >
                <span>{emoji}</span>{label}
              </button>
            ))}
          </div>
        </Card>

        {/* ── 房源描述 ─────────────────────────────────────────────────────── */}
        <Card title="房源描述">
          <Field label="描述" required error={errors.description}>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={5} placeholder="描述房源面积、装修、周边设施、交通、注意事项…"
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
        />

        {submitError && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-2">
            {submitError}
          </div>
        )}
        <motion.button type="submit" disabled={submitting || uploadingImg}
          whileTap={{ scale: submitting ? 1 : 0.97 }}
          className="w-full bg-primary-600 text-white py-4 rounded-2xl font-bold text-base
                     hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? '发布中…' : '发布房源'}
        </motion.button>

        <div className="h-4" />
      </form>
    </div>
  )
}

