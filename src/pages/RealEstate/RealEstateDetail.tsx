// ─── Real Estate Detail Page ──────────────────────────────────────────────────
// Route: /realestate/:id  (mobile)
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, MapPin, Phone, MessageCircle, Copy, Home, User, ExternalLink, BedDouble, Bath, Car, PawPrint, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { LISTING_TYPE_CONFIG, PROPERTY_TYPE_CONFIG, getPriceLabel, getBedroomLabel, type Property } from './types'

export default function RealEstateDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [prop,    setProp]    = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgIdx,  setImgIdx]  = useState(0)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('properties')
      .select('*, poster:users(id, name, avatar_url)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setProp({
            ...data,
            images: data.images ?? [],
            poster: Array.isArray(data.poster) ? (data.poster[0] ?? null) : (data.poster ?? null),
          } as Property)
        }
        setLoading(false)
      })
  }, [id])

  async function copyWechat() {
    if (!prop?.contact_wechat) return
    try {
      await navigator.clipboard.writeText(prop.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert(`微信号：${prop.contact_wechat}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800 flex-1 truncate">
          {loading ? '加载中…' : (prop?.title ?? '房源不存在')}
        </span>
      </div>

      {loading ? (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3 animate-pulse">
          <div className="aspect-video bg-gray-200 rounded-2xl" />
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
        </div>
      ) : !prop ? (
        <div className="text-center py-20 text-gray-400">
          <Home size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">房源不存在或已下架</p>
          <button onClick={() => navigate('/realestate')}
            className="mt-3 text-primary-600 text-sm underline">返回列表</button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto pb-8">

          {/* Images */}
          {prop.images.length > 0 ? (
            <div>
              <div className="aspect-video overflow-hidden bg-gray-100">
                <img src={prop.images[imgIdx]} alt={prop.title} className="w-full h-full object-cover" />
              </div>
              {prop.images.length > 1 && (
                <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white">
                  {prop.images.map((img, i) => (
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
              {PROPERTY_TYPE_CONFIG[prop.property_type].emoji}
            </div>
          )}

          <div className="px-4 py-4 space-y-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              {/* Price + type */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-2xl font-bold text-primary-600">{getPriceLabel(prop)}</p>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${LISTING_TYPE_CONFIG[prop.listing_type].color}`}>
                  {LISTING_TYPE_CONFIG[prop.listing_type].label}
                </span>
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-4 leading-snug">{prop.title}</h1>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  {PROPERTY_TYPE_CONFIG[prop.property_type].emoji} {PROPERTY_TYPE_CONFIG[prop.property_type].label}
                </span>
                {prop.bedrooms != null && (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    <BedDouble size={11} />{getBedroomLabel(prop.bedrooms)}
                  </span>
                )}
                {prop.bathrooms != null && (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    <Bath size={11} />{prop.bathrooms} 卫
                  </span>
                )}
                {prop.area && prop.area.length > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    <MapPin size={11} />{prop.area.join('·')}
                  </span>
                )}
              </div>

              {/* Features */}
              {(prop.pet_friendly || prop.parking || prop.utilities_included) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {prop.pet_friendly && (
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                      <PawPrint size={11} />可养宠物
                    </span>
                  )}
                  {prop.parking && (
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      <Car size={11} />含停车位
                    </span>
                  )}
                  {prop.utilities_included && (
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                      <Zap size={11} />含水电网
                    </span>
                  )}
                </div>
              )}

              {(prop.available_date || prop.address) && (
                <div className="text-sm text-gray-600 space-y-1 mb-4">
                  {prop.available_date && <p>📅 可入住：{new Date(prop.available_date).toLocaleDateString('zh-CN')}</p>}
                  {prop.address && <p>📍 {prop.address}</p>}
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">房源描述</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prop.description}</p>
              </div>
            </motion.div>

            {/* Contact */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <h2 className="text-sm font-semibold text-gray-700 mb-4">联系房东</h2>
              <div className="flex items-center gap-3 mb-4">
                <div
                  onClick={() => prop.poster && navigate(`/provider/${prop.poster.id}`)}
                  className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0
                             cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
                >
                  {prop.poster?.avatar_url
                    ? <img src={prop.poster.avatar_url} alt={prop.contact_name} className="w-full h-full rounded-full object-cover" />
                    : <User size={18} className="text-primary-600" />
                  }
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-1">{prop.contact_name}</span>
                {prop.poster && (
                  <button
                    onClick={() => navigate(`/provider/${prop.poster!.id}`)}
                    className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold
                               bg-primary-50 hover:bg-primary-100 border border-primary-200
                               px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <ExternalLink size={12} />查看主页
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <a href={`tel:${prop.contact_phone}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                             active:scale-95 text-white text-sm font-semibold py-3 rounded-xl transition-all">
                  <Phone size={16} />{prop.contact_phone}
                </a>
                {prop.contact_wechat && (
                  <button onClick={copyWechat}
                    className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600
                               active:scale-95 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-all">
                    {copied ? <Copy size={16} /> : <MessageCircle size={16} />}
                    {copied ? '已复制' : '微信'}
                  </button>
                )}
              </div>
              {prop.contact_wechat && (
                <p className="text-xs text-gray-400 mt-2 text-center">微信号：{prop.contact_wechat}</p>
              )}
            </motion.div>

            {(!user || user.id !== prop.poster_id) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="bg-primary-50 border border-primary-100 rounded-2xl p-4 text-center"
              >
                <p className="text-sm text-primary-700 font-medium mb-2">有房源要发布？</p>
                <button onClick={() => user ? navigate('/realestate/post') : navigate('/login')}
                  className="text-sm text-primary-600 font-semibold underline">免费发布房源</button>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
