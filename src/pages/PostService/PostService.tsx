import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { CATEGORIES } from '../../data/categories'
import type { Service, PostServiceForm, ServiceCategory } from '../../types'
import Header from '../../components/Header/Header'

const TORONTO_AREAS = [
  'Downtown Toronto', 'North York', 'Scarborough', 'Etobicoke',
  'East York', 'York', 'Mississauga', 'Brampton', 'Markham',
  'Richmond Hill', 'Vaughan', 'Oakville', 'Burlington', 'Hamilton',
  'Pickering', 'Ajax', 'Whitby', 'Oshawa',
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
  const addService = useAppStore((s) => s.addService)
  const [form, setForm] = useState<PostServiceForm>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Partial<PostServiceForm>>({})

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const newService: Service = {
      id: `u_${Date.now()}`,
      category: form.category as ServiceCategory,
      title: form.title.trim(),
      description: form.description.trim(),
      price: form.price || '0',
      priceType: form.priceType,
      location: {
        lat: 43.6532 + (Math.random() - 0.5) * 0.3,
        lng: -79.3832 + (Math.random() - 0.5) * 0.3,
        address: form.area,
        city: 'Toronto',
        area: form.area,
      },
      provider: {
        id: `up_${Date.now()}`,
        name: form.name.trim(),
        phone: form.phone.trim(),
        wechat: form.wechat?.trim() || undefined,
        rating: 5.0,
        reviewCount: 0,
        verified: false,
        joinedAt: new Date().toISOString().slice(0, 10),
        languages: ['中文'],
      },
      tags: form.tags
        ? form.tags.split(/[,，\s]+/).filter(Boolean)
        : [],
      available: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    addService(newService)
    setSubmitted(true)
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

  const Field = ({
    label, required, error, children,
  }: {
    label: string; required?: boolean; error?: string; children: React.ReactNode
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )

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
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => update('category', cat.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    form.category === cat.id
                      ? `border-primary-500 ${cat.bgColor}`
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <img src={cat.image} alt={cat.label} className="w-8 h-8 object-contain" />
                  <span className={`text-xs font-medium ${form.category === cat.id ? cat.color : 'text-gray-600'}`}>
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Service info */}
          <div className="card p-4 space-y-4">
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
                placeholder="例：本地搬家, 打包服务, 有货车"
              />
            </Field>
          </div>

          {/* Contact */}
          <div className="card p-4 space-y-4">
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
                placeholder="您的微信号"
              />
            </Field>
          </div>

          {/* Area */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">服务区域</h3>
            <select
              className="input-base"
              value={form.area}
              onChange={(e) => update('area', e.target.value)}
            >
              {TORONTO_AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.97 }}
            className="w-full btn-primary py-4 text-base rounded-2xl"
          >
            免费发布服务
          </motion.button>

          <p className="text-xs text-center text-gray-400">
            发布即表示您同意平台服务条款，内容须合法合规
          </p>
        </form>
      </div>
    </div>
  )
}

