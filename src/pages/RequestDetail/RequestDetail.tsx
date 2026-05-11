import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, MapPin, DollarSign, Calendar, MessageSquare } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { getCategoryById } from '../../data/categories'
import type { ServiceRequest } from '../../types'
import Header from '../../components/Header/Header'
import { toast } from '../../lib/toast'

export default function RequestDetail() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)
  const [req, setReq] = useState<ServiceRequest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    supabase
      .from('service_requests')
      .select('*, requester:users(id, name, avatar_url, phone, wechat)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        setLoading(false)
        if (error || !data) return
        const expires = new Date(data.expires_at)
        const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86_400_000))
        setReq({
          id: data.id,
          userId: data.user_id,
          title: data.title,
          description: data.description ?? '',
          category: data.category,
          area: data.area ?? '',
          city: data.city ?? 'Toronto',
          lat: data.lat ?? undefined,
          lng: data.lng ?? undefined,
          budget: data.budget ?? '',
          expiresAt: data.expires_at,
          status: data.status,
          createdAt: data.created_at,
          requester: {
            id: data.requester?.id ?? data.user_id,
            name: data.requester?.name ?? '用户',
            avatar: data.requester?.avatar_url ?? undefined,
          },
          daysLeft,
        })
      })
  }, [id])

  async function handleContact() {
    if (!user) { navigate('/login', { state: { from: `/requests/${id}` } }); return }
    if (!req) return

    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_provider_id: req.userId,
      p_client_id:   user.id,
      p_service_id:  null,
    })
    if (error || !data) { toast('无法发起会话', 'error'); return }
    navigate('/profile?section=messages', { state: { conversationId: data } })
  }

  async function handleClose() {
    if (!req || req.userId !== user?.id) return
    await supabase.from('service_requests').update({ status: 'closed' }).eq('id', req.id)
    setReq((r) => r ? { ...r, status: 'closed' } : r)
    toast('需求已关闭', 'success')
  }

  const cat = req ? getCategoryById(req.category) : null

  const urgencyColor =
    (req?.daysLeft ?? 99) <= 3 ? 'text-red-500 bg-red-50 border-red-200' :
    (req?.daysLeft ?? 99) <= 7 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                  'text-gray-500 bg-gray-50 border-gray-200'

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="w-full px-4 md:w-[560px] mx-auto py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-gray-500 mb-4 text-sm">
          <ArrowLeft size={16} /> 返回
        </button>

        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100 rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && !req && (
          <div className="text-center py-20 text-gray-400">需求不存在或已关闭</div>
        )}

        {req && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Main card */}
            <div className="card p-5">
              <div className="flex items-start gap-2 mb-3">
                <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full
                                 bg-orange-100 text-orange-600 border border-orange-200">
                  求服务
                </span>
                {req.status === 'closed' && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    已关闭
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold text-gray-900 mb-3">{req.title}</h1>

              {req.description && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{req.description}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {cat && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cat.bgColor} ${cat.color}`}>
                    {cat.emoji} {cat.label}
                  </span>
                )}
                {req.budget && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    <DollarSign size={10} /> {req.budget}
                  </span>
                )}
                {(req.area || req.city) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                    <MapPin size={10} /> {req.area || req.city}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${urgencyColor}`}>
                  <Clock size={10} /> 还剩 {req.daysLeft} 天
                </span>
              </div>
            </div>

            {/* Requester info */}
            <div className="card p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {req.requester.avatar
                  ? <img src={req.requester.avatar} alt="" className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-primary-700">{req.requester.name.slice(0, 1)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{req.requester.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Calendar size={10} />
                  发布于 {new Date(req.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
            </div>

            {/* CTA */}
            {req.status === 'open' && req.userId !== user?.id && (
              <button
                onClick={handleContact}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700
                           text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <MessageSquare size={16} />
                联系发布者
              </button>
            )}

            {req.userId === user?.id && req.status === 'open' && (
              <button
                onClick={handleClose}
                className="w-full py-3 border border-gray-300 text-gray-600 font-semibold
                           rounded-2xl text-sm hover:bg-gray-50 transition-colors"
              >
                关闭需求（已找到服务商）
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
