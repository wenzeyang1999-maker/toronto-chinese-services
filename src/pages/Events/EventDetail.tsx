// ─── Event Detail Page ─────────────────────────────────────────────────────────
// Route: /events/:id  (mobile)
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, MapPin, Phone, MessageCircle, Copy, Calendar, User, ExternalLink, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  EVENT_TYPE_CONFIG, getPriceLabel, formatEventDate, formatEventTime, isUpcoming,
  type Event,
} from './types'

export default function EventDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [ev,      setEv]      = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgIdx,  setImgIdx]  = useState(0)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('events')
      .select('*, poster:users(id, name, avatar_url)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setEv({
            ...data,
            images: data.images ?? [],
            poster: Array.isArray(data.poster) ? (data.poster[0] ?? null) : (data.poster ?? null),
          } as Event)
        }
        setLoading(false)
      })
  }, [id])

  async function copyWechat() {
    if (!ev?.contact_wechat) return
    try {
      await navigator.clipboard.writeText(ev.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert(`微信号：${ev.contact_wechat}`)
    }
  }

  const cfg = ev ? EVENT_TYPE_CONFIG[ev.event_type] : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800 flex-1 truncate">
          {loading ? '加载中…' : (ev?.title ?? '活动不存在')}
        </span>
      </div>

      {loading ? (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3 animate-pulse">
          <div className="aspect-video bg-gray-200 rounded-2xl" />
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
        </div>
      ) : !ev ? (
        <div className="text-center py-20 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">活动不存在或已下架</p>
          <button onClick={() => navigate('/events')}
            className="mt-3 text-primary-600 text-sm underline">返回列表</button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto pb-8">

          {/* Images */}
          {ev.images.length > 0 ? (
            <div>
              <div className="aspect-video overflow-hidden bg-gray-100">
                <img src={ev.images[imgIdx]} alt={ev.title} className="w-full h-full object-cover" />
              </div>
              {ev.images.length > 1 && (
                <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white">
                  {ev.images.map((img, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                        imgIdx === i ? 'border-primary-500' : 'border-transparent'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-gray-50 flex items-center justify-center text-8xl">
              {cfg?.emoji}
            </div>
          )}

          <div className="px-4 py-4 space-y-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              {/* Price + type */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className={`text-2xl font-bold ${ev.price ? 'text-primary-600' : 'text-green-600'}`}>
                  {getPriceLabel(ev)}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isUpcoming(ev) && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">已结束</span>
                  )}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg?.color}`}>
                    {cfg?.emoji} {cfg?.label}
                  </span>
                </div>
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-4 leading-snug">{ev.title}</h1>

              {/* Date/time/location */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Calendar size={14} className="text-primary-500 flex-shrink-0" />
                  <span className="font-semibold">{formatEventDate(ev.event_date)}</span>
                  {ev.event_time && (
                    <span className="text-gray-500">
                      {formatEventTime(ev.event_time)}
                      {ev.event_end_time && ` – ${formatEventTime(ev.event_end_time)}`}
                    </span>
                  )}
                </div>
                {(ev.location_name || ev.address) && (
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <MapPin size={14} className="text-primary-500 flex-shrink-0 mt-0.5" />
                    <span>
                      {ev.location_name && <span className="font-semibold">{ev.location_name}</span>}
                      {ev.location_name && ev.address && ' · '}
                      {ev.address && <span className="text-gray-500">{ev.address}</span>}
                    </span>
                  </div>
                )}
                {ev.area && ev.area.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {ev.area.map((a) => (
                      <span key={a} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-500">{a}</span>
                    ))}
                  </div>
                )}
                {ev.max_attendees && (
                  <p className="text-xs text-gray-500">👥 名额限制：{ev.max_attendees} 人</p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">活动详情</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ev.description}</p>
              </div>
            </motion.div>

            {/* Contact */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <h2 className="text-sm font-semibold text-gray-700 mb-4">联系主办方</h2>
              <div className="flex items-center gap-3 mb-4">
                <div
                  onClick={() => ev.poster && navigate(`/provider/${ev.poster.id}`)}
                  className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0
                             cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
                >
                  {ev.poster?.avatar_url
                    ? <img src={ev.poster.avatar_url} alt={ev.contact_name} className="w-full h-full rounded-full object-cover" />
                    : <User size={18} className="text-primary-600" />
                  }
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-1">{ev.contact_name}</span>
                {ev.poster && (
                  <button
                    onClick={() => navigate(`/provider/${ev.poster!.id}`)}
                    className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold
                               bg-primary-50 hover:bg-primary-100 border border-primary-200
                               px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <ExternalLink size={12} />查看主页
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <a href={`tel:${ev.contact_phone}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                             active:scale-95 text-white text-sm font-semibold py-3 rounded-xl transition-all">
                  <Phone size={16} />{ev.contact_phone}
                </a>
                {ev.contact_wechat && (
                  <button onClick={copyWechat}
                    className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600
                               active:scale-95 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-all">
                    {copied ? <Copy size={16} /> : <MessageCircle size={16} />}
                    {copied ? '已复制' : '微信'}
                  </button>
                )}
              </div>
              {ev.contact_wechat && (
                <p className="text-xs text-gray-400 mt-2 text-center">微信号：{ev.contact_wechat}</p>
              )}
            </motion.div>

            {(!user || user.id !== ev.poster_id) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="bg-primary-50 border border-primary-100 rounded-2xl p-4 text-center"
              >
                <p className="text-sm text-primary-700 font-medium mb-2">有活动要发布？</p>
                <button onClick={() => user ? navigate('/events/post') : navigate('/login')}
                  className="text-sm text-primary-600 font-semibold underline">免费发布活动</button>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
