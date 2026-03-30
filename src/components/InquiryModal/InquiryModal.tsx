// ─── InquiryModal ─────────────────────────────────────────────────────────────
// "获取报价" feature: user posts a need, service providers reach out to them.
// Slides up from bottom on mobile; centered dialog on desktop.
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, ChevronDown, Sparkles, UserCheck, Clock3, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CATEGORIES } from '../../data/categories'

interface Props {
  open: boolean
  onClose: () => void
}

interface InquiryForm {
  categoryId: string
  description: string
  budget: string
  timing: 'asap' | 'flexible' | 'next_week'
  name: string
  phone: string
  wechat: string
}

const INITIAL: InquiryForm = {
  categoryId: '',
  description: '',
  budget: '',
  timing: 'flexible',
  name: '',
  phone: '',
  wechat: '',
}

const TIMING_OPTIONS = [
  { value: 'asap',      label: '尽快' },
  { value: 'flexible',  label: '时间灵活' },
  { value: 'next_week', label: '下周内' },
] as const

export default function InquiryModal({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const [form, setForm]         = useState<InquiryForm>(INITIAL)
  const [errors, setErrors]     = useState<Partial<Record<keyof InquiryForm, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]         = useState(false)
  const [serverError, setServerError] = useState('')

  const update = <K extends keyof InquiryForm>(field: K, value: InquiryForm[K]) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof InquiryForm, string>> = {}
    if (!form.categoryId)          errs.categoryId  = '请选择服务类型'
    if (!form.description.trim())  errs.description = '请描述您的需求'
    if (!form.name.trim())         errs.name        = '请填写姓名'
    if (!form.phone.trim()) {
      errs.phone = '请填写联系电话'
    } else if (!/^[\d\s\-+().]{7,20}$/.test(form.phone.trim())) {
      errs.phone = '请输入有效的电话号码'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setServerError('')
    try {
      const { error } = await supabase.from('inquiries').insert({
        category_id: form.categoryId,
        description: form.description.trim(),
        budget:      form.budget.trim() || null,
        timing:      form.timing,
        name:        form.name.trim(),
        phone:       form.phone.trim(),
        wechat:      form.wechat.trim() || null,
        user_id:     user?.id ?? null,
        status:      'open',
      })
      if (error) throw error
      setDone(true)
    } catch {
      setServerError('提交失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    onClose()
    // Reset after animation finishes
    setTimeout(() => { setForm(INITIAL); setErrors({}); setDone(false); setServerError('') }, 350)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 z-50"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl
                       md:inset-0 md:m-auto md:rounded-3xl md:max-w-lg md:max-h-[90vh] md:overflow-hidden"
            style={{ maxHeight: '92vh' }}
          >
            {/* Handle bar (mobile) */}
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">免费获取报价</h2>
                <p className="text-xs text-gray-400 mt-0.5">填写需求，服务商主动联系您</p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 130px)' }}>
              {done ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-16 px-8 text-center"
                >
                  <CheckCircle size={60} className="text-green-500 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">需求已发布！</h3>
                  <p className="text-sm text-gray-500 mb-2">
                    服务商将通过您留的电话或微信联系您，请保持畅通。
                  </p>
                  <p className="text-xs text-gray-400 mb-8">通常在 24 小时内收到回复</p>
                  <button
                    onClick={handleClose}
                    className="btn-primary px-8"
                  >
                    好的
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 pb-8">

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      服务类型 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={form.categoryId}
                        onChange={(e) => update('categoryId', e.target.value)}
                        className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                                   text-gray-800 bg-white outline-none focus:ring-2 focus:ring-primary-400
                                   focus:border-transparent pr-9"
                      >
                        <option value="">请选择服务类型...</option>
                        {CATEGORIES.filter((c) => c.id !== 'other').map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.emoji} {c.label}
                          </option>
                        ))}
                        <option value="other">其他服务</option>
                      </select>
                      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      需求描述 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                      placeholder="请描述您的需求，例如：需要搬两居室，3楼无电梯，下周末可以..."
                      maxLength={300}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
                                 outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                                 resize-none"
                    />
                    <p className="text-xs text-gray-400 text-right mt-0.5">{form.description.length}/300</p>
                    {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      预算范围 <span className="text-gray-400 font-normal text-xs">（可选）</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="text"
                        value={form.budget}
                        onChange={(e) => update('budget', e.target.value)}
                        placeholder="例：100–200"
                        className="w-full border border-gray-200 rounded-xl pl-7 pr-4 py-2.5 text-sm
                                   text-gray-800 outline-none focus:ring-2 focus:ring-primary-400
                                   focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Timing */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">希望服务时间</label>
                    <div className="flex gap-2">
                      {TIMING_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => update('timing', opt.value)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-all ${
                            form.timing === opt.value
                              ? 'border-primary-500 bg-primary-50 text-primary-600'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">联系方式</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      姓名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      placeholder="您的称呼"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                                 text-gray-800 outline-none focus:ring-2 focus:ring-primary-400
                                 focus:border-transparent"
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      电话 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder="647-xxx-xxxx"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                                 text-gray-800 outline-none focus:ring-2 focus:ring-primary-400
                                 focus:border-transparent"
                    />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>

                  {/* WeChat */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      微信号 <span className="text-gray-400 font-normal text-xs">（可选）</span>
                    </label>
                    <input
                      type="text"
                      value={form.wechat}
                      onChange={(e) => update('wechat', e.target.value)}
                      placeholder="您的微信号"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                                 text-gray-800 outline-none focus:ring-2 focus:ring-primary-400
                                 focus:border-transparent"
                    />
                  </div>

                  {serverError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3">
                      {serverError}
                    </div>
                  )}

                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileTap={{ scale: submitting ? 1 : 0.97 }}
                    className="w-full btn-primary py-3.5 text-sm rounded-2xl disabled:opacity-60"
                  >
                    {submitting ? '提交中...' : '免费获取报价'}
                  </motion.button>

                  {/* How it works */}
                  <div className="rounded-2xl bg-primary-50 border border-primary-100 px-4 py-4 space-y-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Sparkles size={13} className="text-primary-500" />
                      <span className="text-xs font-semibold text-primary-700 tracking-wide">AI 智能匹配流程</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles size={11} className="text-primary-500" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700">AI 自动匹配附近服务商</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">系统将根据您的需求与所在区域，自动筛选评分高、距离近的服务商</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <UserCheck size={11} className="text-primary-500" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700">服务商主动联系您</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">匹配到的服务商将通过电话或微信与您取得联系，提供报价及方案</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Clock3 size={11} className="text-primary-500" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700">通常 24 小时内收到回复</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">高峰时段可能略有延迟，您可同时收到多家报价，自由比较选择</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-primary-100">
                      <ShieldCheck size={12} className="text-primary-400 flex-shrink-0" />
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        您的联系方式仅用于服务商回复，不会公开展示或转让给第三方
                      </p>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
