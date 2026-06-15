// ─── Event Drawer ──────────────────────────────────────────────────────────────
// Bottom sheet shown from PlazaPage — full event detail without page nav.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, MapPin, Phone, MessageCircle, Copy, Check, ExternalLink, Clock, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from '../../lib/toast'
import { useReadStore } from '../../store/readStore'
import SaveButton from '../SaveButton/SaveButton'
import {
  EVENT_TYPE_CONFIG, getPriceLabel, formatEventDate, formatEventTime, isUpcoming,
  type Event,
} from '../../pages/Events/types'

interface Props {
  eventId: string
  onClose: () => void
}

export default function EventDrawer({ eventId, onClose }: Props) {
  const navigate = useNavigate()
  const markRead = useReadStore((s) => s.markRead)

  const [ev,      setEv]      = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgIdx,  setImgIdx]  = useState(0)
  const [copied,  setCopied]  = useState(false)
  const [failedImgs, setFailedImgs] = useState<Set<number>>(new Set())

  useEffect(() => {
    markRead('event', eventId)
    setLoading(true)
    setEv(null)
    setImgIdx(0)

    supabase
      .from('events')
      .select('*, poster:users(id, name, avatar_url)')
      .eq('id', eventId)
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
  }, [eventId])

  async function copyWechat() {
    if (!ev?.contact_wechat) return
    try {
      await navigator.clipboard.writeText(ev.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(`微信号：${ev.contact_wechat}（请手动复制）`)
    }
  }

  const cfg  = ev ? EVENT_TYPE_CONFIG[ev.event_type] : null
  const past = ev ? !isUpcoming(ev) : false

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[50]"
      />
      <motion.div
        key="drawer"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="fixed bottom-0 left-0 right-0 z-[51] bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-600">同城活动</span>
          <div className="flex items-center gap-2">
            {ev && (
              <>
                <SaveButton type="event" id={ev.id} size={18} className="w-8 h-8" />
                <button
                  onClick={() => { onClose(); navigate(`/events/${eventId}`) }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                  title="在新页面打开"
                >
                  <ExternalLink size={16} />
                </button>
              </>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="max-w-2xl mx-auto px-4 py-4 animate-pulse space-y-4">
              {/* Image placeholder */}
              <div className="w-full aspect-video bg-gray-100 rounded-2xl" />
              {/* Title + badge */}
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>
              {/* Info pills row */}
              <div className="flex gap-2">
                <div className="h-7 bg-gray-100 rounded-full w-28" />
                <div className="h-7 bg-gray-100 rounded-full w-20" />
                <div className="h-7 bg-gray-100 rounded-full w-24" />
              </div>
              {/* Description lines */}
              <div className="space-y-2">
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-5/6" />
                <div className="h-3 bg-gray-100 rounded w-4/6" />
              </div>
              {/* Contact card */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                </div>
                <div className="h-11 bg-gray-200 rounded-xl" />
              </div>
            </div>
          ) : !ev ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">活动不存在</div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {/* Image */}
              {ev.images.length > 0 ? (
                <div>
                  <div className="aspect-video overflow-hidden bg-gray-100">
                    {failedImgs.has(imgIdx) ? (
                      <div className="w-full h-full flex items-center justify-center text-7xl bg-gray-50">
                        {cfg?.emoji}
                      </div>
                    ) : (
                      <img
                        src={ev.images[imgIdx]}
                        alt={ev.title}
                        className="w-full h-full object-cover"
                        onError={() => setFailedImgs((s) => new Set(s).add(imgIdx))}
                      />
                    )}
                  </div>
                  {ev.images.length > 1 && (
                    <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white">
                      {ev.images.map((img, i) => (
                        <button key={i} onClick={() => setImgIdx(i)}
                          className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                            imgIdx === i ? 'border-primary-500' : 'border-transparent'
                          }`}
                        >
                          {failedImgs.has(i) ? (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-lg">
                              {cfg?.emoji}
                            </div>
                          ) : (
                            <img
                              src={img}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={() => setFailedImgs((s) => new Set(s).add(i))}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-gray-50 flex items-center justify-center text-7xl">
                  {cfg?.emoji}
                </div>
              )}

              <div className="px-4 py-4 space-y-3 pb-6">
                {/* Main info card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  {/* Price + type */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className={`text-xl font-bold ${ev.price ? 'text-primary-600' : 'text-green-600'}`}>
                      {getPriceLabel(ev)}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {past && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">已结束</span>
                      )}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg?.color}`}>
                        {cfg?.emoji} {cfg?.label}
                      </span>
                    </div>
                  </div>
                  <h1 className="text-base font-bold text-gray-900 mb-3 leading-snug">{ev.title}</h1>

                  {/* Date/time/location */}
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar size={14} className="text-primary-500 flex-shrink-0" />
                      <span className="font-semibold">{formatEventDate(ev.event_date)}</span>
                      {ev.event_time && (
                        <span className="text-gray-500 flex items-center gap-1">
                          <Clock size={12} />
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
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Users size={11} /> 名额限制：{ev.max_attendees} 人
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  {ev.description && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">活动详情</p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ev.description}</p>
                    </div>
                  )}
                </div>

                {/* Contact card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">联系主办方</h2>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      onClick={() => ev.poster && (onClose(), navigate(`/provider/${ev.poster.id}`))}
                      className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 cursor-pointer"
                    >
                      {ev.poster?.avatar_url
                        ? <img src={ev.poster.avatar_url} alt={ev.contact_name} className="w-full h-full rounded-full object-cover" />
                        : <span className="text-primary-600 font-bold text-sm">{ev.contact_name?.charAt(0)}</span>
                      }
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-1">{ev.contact_name}</span>
                    {ev.poster && (
                      <button
                        onClick={() => { onClose(); navigate(`/provider/${ev.poster!.id}`) }}
                        className="flex items-center gap-1 text-xs text-primary-600 font-semibold
                                   bg-primary-50 hover:bg-primary-100 border border-primary-200
                                   px-2.5 py-1.5 rounded-xl transition-colors"
                      >
                        <ExternalLink size={11} />查看主页
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:${ev.contact_phone}`}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                                 active:scale-95 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
                      <Phone size={15} />{ev.contact_phone}
                    </a>
                    {ev.contact_wechat && (
                      <button onClick={copyWechat}
                        className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600
                                   active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all">
                        {copied ? <Check size={15} /> : <MessageCircle size={15} />}
                        {copied ? '已复制' : '微信'}
                      </button>
                    )}
                  </div>
                  {ev.contact_wechat && (
                    <p className="text-xs text-gray-400 mt-2 text-center">微信号：{ev.contact_wechat}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
