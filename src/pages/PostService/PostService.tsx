import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Search, ImagePlus, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { CATEGORIES } from '../../data/categories'
import type { PostServiceForm } from '../../types'
import Header from '../../components/Header/Header'

const TORONTO_AREAS = [
  // ── Greater Toronto Area ──
  'Downtown Toronto 多伦多市中心',
  'North York 北约克',
  'Scarborough 士嘉堡',
  'Etobicoke 怡陶碧谷',
  'East York 东约克',
  'York 约克',
  'Markham 万锦',
  'Richmond Hill 列治文山',
  'Vaughan 万锦以北/旺市',
  'Mississauga 密西沙加',
  'Brampton 宾顿',
  'Oakville 奥克维尔',
  'Burlington 柏灵顿',
  'Milton 米尔顿',
  'Pickering 皮克灵',
  'Ajax 阿积士',
  'Whitby 惠特比',
  'Oshawa 奥沙华',
  'Newmarket 新市',
  'Aurora 奥罗拉',
  'King City 金城',
  'Stouffville 士多福维尔',
  'Georgina 乔治纳',
  'Caledon 卡利顿',
  'Halton Hills 哈顿山',
  'Innisfil 因尼斯菲尔',
  'Barrie 巴里',
  'Collingwood 科灵伍德',
  // ── 华人聚集区 ──
  'Agincourt 阿金科特',
  'Warden / Sheppard',
  'Kennedy / Finch',
  'Pacific Mall 太古广场',
  'First Markham Place 首都广场',
  // ── 南安省 ──
  'Hamilton 汉密尔顿',
  'Kitchener 基秦拿',
  'Waterloo 滑铁卢',
  'Cambridge 剑桥',
  'Guelph 圭尔夫',
  'London 伦敦市',
  'Windsor 温莎',
  'Niagara Falls 尼亚加拉瀑布',
  'St. Catharines 圣凯瑟琳斯',
  'Welland 韦兰',
  // ── 东安省 ──
  'Ottawa 渥太华',
  'Kingston 金斯顿',
  'Belleville 贝尔维尔',
  'Peterborough 彼得堡',
  'Cobourg 科堡',
  // ── 北安省 ──
  'Sudbury 萨德伯里',
  'Thunder Bay 桑德贝',
  'Sault Ste. Marie 苏圣玛丽',
  'North Bay 北湾',
  'Timmins 蒂明斯',
]

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
  const navigate = useNavigate()
  const fetchServices = useAppStore((s) => s.fetchServices)
  const user = useAuthStore((s) => s.user)
  const [form, setForm] = useState<PostServiceForm>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<Partial<PostServiceForm>>({})
  const [catSearch, setCatSearch]         = useState('')
  const [areaSearch, setAreaSearch]       = useState('')
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false)
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])

  const HOT_AREAS = [
    'North York 北约克',
    'Markham 万锦',
    'Scarborough 士嘉堡',
    'Richmond Hill 列治文山',
    'Mississauga 密西沙加',
    'Downtown Toronto 多伦多市中心',
    'Vaughan 万锦以北/旺市',
  ]

  const toggleArea = (a: string) =>
    setSelectedAreas((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])

  const confirmAreaInput = () => {
    const val = areaSearch.trim()
    if (!val) return
    if (!selectedAreas.includes(val)) setSelectedAreas((prev) => [...prev, val])
    setAreaSearch('')
    setAreaDropdownOpen(false)
  }

  const filteredAreas = areaSearch
    ? TORONTO_AREAS.filter((a) => a.toLowerCase().includes(areaSearch.toLowerCase()) && !selectedAreas.includes(a))
    : []
  const [customCategory, setCustomCategory] = useState('')
  const [confirmedCustom, setConfirmedCustom] = useState('')

  const confirmCustom = () => {
    const val = customCategory.trim()
    if (!val) return
    setConfirmedCustom(val)
    setCustomCategory('')
    update('category', 'other')
    setTimeout(() => scrollTo(serviceInfoRef), 400)
  }
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const serviceInfoRef = useRef<HTMLDivElement>(null)
  const contactRef     = useRef<HTMLDivElement>(null)
  const areaRef        = useRef<HTMLDivElement>(null)

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const remaining = 3 - images.length
    const toAdd = files.slice(0, remaining)
    setImages((prev) => [...prev, ...toAdd])
    setPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const handleImageRemove = (index: number) => {
    URL.revokeObjectURL(previews[index])
    setImages((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const update = (field: keyof PostServiceForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const validate = () => {
    const errs: Partial<PostServiceForm> = {}
    if (!form.title.trim()) errs.title = '请填写服务标题'
    if (!form.description.trim()) errs.description = '请填写服务描述'
    if (!form.price.trim() && form.priceType !== 'negotiable') errs.price = '请填写价格'
    if (!form.name.trim()) errs.name = '请填写联系人姓名'
    if (!form.phone.trim()) errs.phone = '请填写联系电话'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    if (!user) {
      navigate('/login')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    try {
      // 1. Update user's contact info in users table
      await supabase.from('users').upsert({
        id: user.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        wechat: form.wechat?.trim() || null,
      })

      // 2. Upload images to Supabase Storage
      const imageUrls: string[] = []
      for (const file of images) {
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('service-images')
          .upload(path, file, { upsert: false })
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('service-images')
            .getPublicUrl(path)
          imageUrls.push(publicUrl)
        }
      }

      // 3. Insert service into Supabase
      const { error } = await supabase.from('services').insert({
        category_id: form.category,
        title: form.title.trim(),
        description: form.description.trim(),
        price: form.priceType === 'negotiable' ? 0 : parseFloat(form.price) || 0,
        price_type: form.priceType,
        lat: 43.6532,
        lng: -79.3832,
        area: selectedAreas.join(', ') || 'Toronto',
        city: 'Toronto',
        provider_id: user.id,
        tags: form.tags ? form.tags.split(/[,，\s]+/).filter(Boolean) : [],
        images: imageUrls,
        is_available: true,
        is_verified: false,
      })

      if (error) throw error

      // 4. Refresh services list
      await fetchServices()
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err?.message ?? '发布失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <CheckCircle size={72} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">发布成功！</h2>
          <p className="text-gray-500 mb-8">您的服务已发布，附近的客户可以找到您了</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
            >
              返回首页
            </button>
            <button
              onClick={() => {
                setForm(INITIAL_FORM)
                setSubmitted(false)
              }}
              className="text-gray-500 text-sm underline"
            >
              继续发布服务
            </button>
          </div>
        </motion.div>
      </div>
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
          {/* Category */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">服务类型 *</h3>

            {/* Search */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="搜索服务类型..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              />
            </div>

            {/* Confirmed custom tag */}
            {confirmedCustom && (
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => update('category', 'other')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all ${
                    form.category === 'other'
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {confirmedCustom}
                  <span
                    onClick={(e) => { e.stopPropagation(); setConfirmedCustom(''); update('category', 'moving') }}
                    className="text-gray-400 hover:text-red-400 leading-none"
                  >
                    ✕
                  </span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {CATEGORIES.filter((cat) =>
                catSearch === '' ||
                cat.postLabel.includes(catSearch) ||
                cat.searchTags.some((t) => t.includes(catSearch))
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { update('category', cat.id); scrollTo(serviceInfoRef) }}
                  className={`flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:p-3 rounded-xl border-2 transition-all ${
                    form.category === cat.id
                      ? `border-primary-500 ${cat.bgColor}`
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* Icon — hidden on mobile */}
                  <img src={cat.image} alt={cat.postLabel} className="hidden sm:block w-8 h-8 object-contain" />
                  <span className={`text-xs font-medium ${form.category === cat.id ? cat.color : 'text-gray-600'}`}>
                    {cat.postLabel}
                  </span>
                </button>
              ))}

              {/* 其他服务 */}
              <button
                type="button"
                onClick={() => update('category', 'other')}
                className={`flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:p-3 rounded-xl border-2 transition-all ${
                  form.category === 'other'
                    ? 'border-primary-500 bg-gray-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="hidden sm:block text-2xl">＋</span>
                <span className={`text-xs font-medium ${form.category === 'other' ? 'text-primary-600' : 'text-gray-600'}`}>
                  其他服务
                </span>
              </button>
            </div>

            {/* Custom category input — shown when 其他 selected and not yet confirmed */}
            {form.category === 'other' && !confirmedCustom && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmCustom())}
                  placeholder="例：钢琴教学、翻译"
                  autoFocus
                  className="flex-1 px-4 py-2.5 text-sm border border-primary-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={confirmCustom}
                  className="px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors flex-shrink-0"
                >
                  确认
                </button>
              </div>
            )}
          </div>

          {/* Service info */}
          <div ref={serviceInfoRef} className="card p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">服务信息</h3>

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

            {/* Images */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                服务图片 <span className="text-gray-400 font-normal">（最多 3 张）</span>
              </label>
              <div className="flex gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleImageRemove(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors flex-shrink-0"
                  >
                    <ImagePlus size={22} />
                    <span className="text-xs">{previews.length === 0 ? '添加图片' : '继续添加'}</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageAdd}
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">价格 *</label>
              <div className="flex gap-2">
                <div className="flex rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                  {[
                    { v: 'hourly', l: '时薪' },
                    { v: 'fixed', l: '固定价' },
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

          {/* Contact */}
          <div ref={contactRef} className="card p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">联系方式</h3>

            <Field label="联系人姓名" required error={errors.name}>
              <input
                className="input-base"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="您的称呼"
              />
            </Field>

            <Field label="联系电话" required error={errors.phone}>
              <input
                className="input-base"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="647-xxx-xxxx"
                type="tel"
              />
            </Field>

            <Field label="微信号（可选）">
              <input
                className="input-base"
                value={form.wechat}
                onChange={(e) => update('wechat', e.target.value)}
                onBlur={() => scrollTo(areaRef)}
                placeholder="您的微信号"
              />
            </Field>
          </div>

          {/* Area */}
          <div ref={areaRef} className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">服务区域</h3>

            {/* Search input + selected tags inline */}
            <div className="flex flex-wrap items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-transparent bg-white mb-3 relative">
              {selectedAreas.map((a) => (
                <span key={a} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 border border-primary-300 text-primary-600 text-xs font-medium flex-shrink-0">
                  {a}
                  <button type="button" onClick={() => toggleArea(a)} className="text-primary-400 hover:text-red-400">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={areaSearch}
                onChange={(e) => { setAreaSearch(e.target.value); setAreaDropdownOpen(true) }}
                onFocus={() => setAreaDropdownOpen(true)}
                onBlur={() => setTimeout(() => setAreaDropdownOpen(false), 150)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmAreaInput())}
                placeholder={selectedAreas.length === 0 ? '搜索或输入区域，Enter 确认...' : '继续添加...'}
                className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
              />

              {/* Dropdown */}
              {areaDropdownOpen && filteredAreas.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                  {filteredAreas.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { toggleArea(a); setAreaSearch(''); setAreaDropdownOpen(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hot areas */}
            <p className="text-xs text-gray-400 mb-2">热门地区</p>
            <div className="flex flex-wrap gap-2">
              {HOT_AREAS.map((a) => {
                const selected = selectedAreas.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleArea(a)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      selected
                        ? 'bg-primary-50 border-primary-400 text-primary-600'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
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

// ── Sub-components (defined outside to prevent remount on every render) ───────
function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

