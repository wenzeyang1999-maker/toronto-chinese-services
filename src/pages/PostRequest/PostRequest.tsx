import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { supabase } from '../../lib/supabase'
import { CATEGORIES } from '../../data/categories'
import type { ServiceCategory } from '../../types'
import Header from '../../components/Header/Header'
import { toast } from '../../lib/toast'
import { moderateContent } from '../../hooks/useContentModeration'

const TORONTO_AREAS = [
  'Downtown Toronto 多伦多市中心', 'North York 北约克', 'Scarborough 士嘉堡',
  'Etobicoke 怡陶碧谷', 'Markham 万锦', 'Richmond Hill 列治文山',
  'Vaughan 旺市', 'Mississauga 密西沙加', 'Brampton 宾顿',
  'Oakville 奥克维尔', 'Ajax 阿积士', 'Whitby 惠特比',
  'Newmarket 新市', 'Aurora 奥罗拉', 'Stouffville 士多福维尔',
]

const EXPIRY_OPTIONS = [
  { label: '7 天', days: 7 },
  { label: '14 天', days: 14 },
  { label: '30 天', days: 30 },
]

export default function PostRequest() {
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)
  const addServiceRequest = useAppStore((s) => s.addServiceRequest)

  const [title,    setTitle]    = useState('')
  const [category, setCategory] = useState<ServiceCategory>('other')
  const [desc,     setDesc]     = useState('')
  const [area,     setArea]     = useState('')
  const [budget,   setBudget]   = useState('')
  const [days,     setDays]     = useState(14)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  if (!user) {
    navigate('/login', { state: { from: '/requests/post' } })
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)

    const modResult = await moderateContent({ title, description: desc })
    if (!modResult.pass) {
      toast(`内容审核未通过：${modResult.reason ?? '包含违规内容'}`, 'error')
      setLoading(false)
      return
    }
    const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()

    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        user_id:    user!.id,
        title:      title.trim(),
        description: desc.trim() || null,
        category,
        area:       area || null,
        city:       'Toronto',
        budget:     budget.trim() || null,
        expires_at: expiresAt,
        status:     'open',
      })
      .select('*, requester:users(id, name, avatar_url)')
      .single()

    setLoading(false)

    if (error) {
      toast('发布失败，请重试', 'error')
      return
    }

    const daysLeft = days
    addServiceRequest({
      id: data.id,
      userId: data.user_id,
      title: data.title,
      description: data.description ?? '',
      category: data.category,
      area: data.area ?? '',
      city: data.city ?? 'Toronto',
      lat: undefined,
      lng: undefined,
      budget: data.budget ?? '',
      expiresAt: data.expires_at,
      status: 'open',
      createdAt: data.created_at,
      requester: {
        id: data.requester?.id ?? user!.id,
        name: data.requester?.name ?? '用户',
        avatar: data.requester?.avatar_url ?? undefined,
      },
      daysLeft,
    })

    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6">
        <CheckCircle size={56} className="text-green-500" />
        <h2 className="text-xl font-bold text-gray-800">发布成功！</h2>
        <p className="text-sm text-gray-500 text-center">
          服务商看到你的需求后可以直接联系你
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold"
          >
            返回首页
          </button>
          <button
            onClick={() => { setDone(false); setTitle(''); setDesc(''); setBudget(''); setArea('') }}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold"
          >
            再发一条
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="w-full px-4 md:w-[520px] mx-auto py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-gray-500 mb-4 text-sm">
          <ArrowLeft size={16} /> 返回
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-1">发布服务需求</h1>
        <p className="text-sm text-gray-400 mb-6">让附近的服务商主动找到你</p>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Title */}
          <div className="card p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              我需要什么服务？ <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：急需搬家帮手，周末可用"
              maxLength={60}
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{title.length}/60</p>
          </div>

          {/* Category */}
          <div className="card p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">服务类别</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all
                    ${category === cat.id
                      ? `${cat.bgColor} ${cat.color} border-current`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.postLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="card p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              详细描述 <span className="text-gray-400 font-normal">（可选）</span>
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="补充说明时间、要求、数量等细节…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Area + Budget row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">所在区域</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                <option value="">选择区域</option>
                {TORONTO_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="card p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                预算 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="面议 / $50/时"
                maxLength={20}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>

          {/* Expiry */}
          <div className="card p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">有效期</label>
            <div className="flex gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setDays(opt.days)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all
                    ${days === opt.days
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50
                       text-white font-bold rounded-xl text-sm transition-colors"
          >
            {loading ? '发布中…' : '发布需求'}
          </button>
        </motion.form>
      </div>
    </div>
  )
}
