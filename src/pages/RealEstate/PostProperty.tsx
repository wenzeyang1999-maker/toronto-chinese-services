// ─── Post Property Page ───────────────────────────────────────────────────────
// Route: /realestate/post
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, CheckCircle, ImagePlus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useRealEstateStore } from '../../store/realestateStore'
import { compressImage, validateImageFile } from '../../lib/compressImage'
import {
  LISTING_TYPE_CONFIG, PROPERTY_TYPE_CONFIG, PRICE_TYPE_LABEL,
  type RealEstateListingType, type PropertyType, type PriceType, type Property,
} from './types'

const GTA_AREAS = [
  '多伦多市区', '北约克', '士嘉堡', '密西沙加', '万锦',
  '列治文山', '奥克维尔', '宾顿', '安省其他',
]

const MAX_IMAGES = 6

interface FormState {
  listing_type: RealEstateListingType
  title: string
  property_type: PropertyType
  bedrooms: string
  bathrooms: string
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
  bedrooms: '', bathrooms: '',
  description: '', price: '', price_type: 'monthly',
  pet_friendly: false, parking: false, utilities_included: false,
  area: [], address: '', available_date: '',
  contact_name: '', contact_phone: '', contact_wechat: '',
}

export default function PostProperty() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const addProperty = useRealEstateStore((s) => s.addProperty)

  const [form,         setForm]        = useState<FormState>(INITIAL)
  const [images,       setImages]      = useState<File[]>([])
  const [previews,     setPreviews]    = useState<string[]>([])
  const [errors,       setErrors]      = useState<Partial<Record<keyof FormState | 'images', string>>>({})
  const [submitting,   setSubmitting]  = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [done,         setDone]        = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])

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

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''
    const toProcess = files.slice(0, MAX_IMAGES - images.length)
    for (const file of toProcess) {
      const err = validateImageFile(file)
      if (err) { setErrors((prev) => ({ ...prev, images: err })); return }
    }
    setUploadingImg(true)
    const compressed = await Promise.all(toProcess.map((f) => compressImage(f)))
    setImages((prev) => [...prev, ...compressed])
    setPreviews((prev) => [...prev, ...compressed.map((f) => URL.createObjectURL(f))])
    setErrors((e) => ({ ...e, images: undefined }))
    setUploadingImg(false)
  }

  function removeImage(idx: number) {
    URL.revokeObjectURL(previews[idx])
    setImages((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
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
    setSubmitting(true)

    const imageUrls: string[] = []
    for (const file of images) {
      const path = `realestate/${user.id}/${Date.now()}-${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('service-images')
        .upload(path, file, { upsert: true })
      if (uploadErr) {
        setErrors({ title: `图片上传失败：${uploadErr.message}` })
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
      description:        form.description.trim(),
      price:              form.price_type !== 'negotiable' && form.price ? parseFloat(form.price) : null,
      price_type:         form.price_type,
      pet_friendly:       form.pet_friendly,
      parking:            form.parking,
      utilities_included: form.utilities_included,
      images:             imageUrls,
      area:               form.area.length > 0 ? form.area : null,
      city:               'Toronto',
      address:            form.address.trim() || null,
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

    if (error) { setErrors({ title: `发布失败：${error.message}` }); return }

    if (data) {
      addProperty({
        ...data,
        images: data.images ?? [],
        poster: Array.isArray(data.poster) ? (data.poster[0] ?? null) : (data.poster ?? null),
      } as Property)
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center max-w-sm w-full"
        >
          <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">房源已发布！</h2>
          <p className="text-sm text-gray-500 mb-6">租客 / 买家可以联系您了</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => navigate('/realestate')}
              className="w-full bg-primary-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-primary-700 transition-colors">
              查看房源列表
            </button>
            <button onClick={() => {
              previews.forEach(URL.revokeObjectURL)
              setForm(INITIAL); setImages([]); setPreviews([]); setDone(false)
            }}
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
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800">发布房源</span>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-5 space-y-4">

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
                <img src={src} alt="" className="w-full h-full object-cover" />
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
          {errors.images && <p className="text-xs text-red-500 mt-1">{errors.images}</p>}
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

          {/* Area */}
          <Field label="地区" required error={errors.area}>
            <div className="flex flex-wrap gap-2">
              {GTA_AREAS.map((a) => {
                const selected = form.area.includes(a)
                return (
                  <button key={a} type="button"
                    onClick={() => set('area', selected ? form.area.filter((x) => x !== a) : [...form.area, a])}
                    className={`text-sm px-3 py-1.5 rounded-xl border transition-colors ${
                      selected
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                    }`}
                  >{a}</button>
                )
              })}
            </div>
            {form.area.length > 0 && (
              <p className="text-xs text-gray-400 mt-1.5">已选：{form.area.join('、')}</p>
            )}
          </Field>

          <Field label="详细地址（选填）">
            <input value={form.address} onChange={(e) => set('address', e.target.value)}
              placeholder="例：Jane & Finch 附近，无需填写门牌号"
              className={input(false)} />
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
        <Card title="联系方式">
          <Field label="姓名" required error={errors.contact_name}>
            <input value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)}
              placeholder="联系人姓名" className={input(!!errors.contact_name)} />
          </Field>
          <Field label="联系电话" required error={errors.contact_phone}>
            <input type="tel" value={form.contact_phone}
              onChange={(e) => set('contact_phone', e.target.value)}
              placeholder="647-xxx-xxxx" className={input(!!errors.contact_phone)} />
          </Field>
          <Field label="微信号（选填）">
            <input value={form.contact_wechat} onChange={(e) => set('contact_wechat', e.target.value)}
              placeholder="微信号" className={input(false)} />
          </Field>
        </Card>

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

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, required, error, className = '', children }: {
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
