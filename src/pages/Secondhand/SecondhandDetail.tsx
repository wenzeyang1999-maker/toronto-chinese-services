// ─── Secondhand Detail Page ───────────────────────────────────────────────────
// Route: /secondhand/:id  (used on mobile)
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, MapPin, Phone, MessageCircle, Copy, Package, User, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { SECONDHAND_CATEGORY_CONFIG, ITEM_CONDITION_CONFIG, getPriceLabel, type SecondhandItem } from './types'
import SaveButton from '../../components/SaveButton/SaveButton'
import ShareButton from '../../components/ShareButton/ShareButton'
import PageMeta from '../../components/PageMeta/PageMeta'
import ViewCount from '../../components/ViewCount/ViewCount'

export default function SecondhandDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [item,    setItem]    = useState<SecondhandItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgIdx,  setImgIdx]  = useState(0)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('secondhand')
      .select('*, seller:users(id, name, avatar_url)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setItem({
            ...data,
            images: data.images ?? [],
            seller: Array.isArray(data.seller) ? (data.seller[0] ?? null) : (data.seller ?? null),
          } as SecondhandItem)
        }
        setLoading(false)
      })
  }, [id])

  async function copyWechat() {
    if (!item?.contact_wechat) return
    try {
      await navigator.clipboard.writeText(item.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert(`微信号：${item.contact_wechat}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800 flex-1 truncate">
          {loading ? '加载中…' : (item?.title ?? '物品不存在')}
        </span>
        {item && <SaveButton type="secondhand" id={item.id} size={20} className="w-9 h-9" />}
        {item && <ShareButton title={item.title} size={18} className="w-9 h-9" />}
      </div>

      {loading ? (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3 animate-pulse">
          <div className="aspect-video bg-gray-200 rounded-2xl" />
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
        </div>
      ) : !item ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">物品不存在或已下架</p>
          <button onClick={() => navigate('/secondhand')}
            className="mt-3 text-primary-600 text-sm underline">返回列表</button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto pb-8">
          <PageMeta
            title={item.title}
            description={item.description?.slice(0, 120)}
            image={item.images?.[0]}
          />

          {/* Images */}
          {item.images.length > 0 ? (
            <div>
              <div className="aspect-video overflow-hidden bg-gray-100">
                <img src={item.images[imgIdx]} alt={item.title}
                  className="w-full h-full object-contain" />
              </div>
              {item.images.length > 1 && (
                <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white">
                  {item.images.map((img, i) => (
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
              {SECONDHAND_CATEGORY_CONFIG[item.category].emoji}
            </div>
          )}

          <div className="px-4 py-4 space-y-4">

            {/* Main card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              {/* Title + condition */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-xl font-bold text-gray-900 leading-tight flex-1">{item.title}</h1>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${ITEM_CONDITION_CONFIG[item.condition].color}`}>
                  {ITEM_CONDITION_CONFIG[item.condition].label}
                </span>
              </div>

              {/* Price */}
              <p className={`text-2xl font-bold mb-4 ${item.is_free ? 'text-green-600' : 'text-primary-600'}`}>
                {getPriceLabel(item)}
              </p>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  {SECONDHAND_CATEGORY_CONFIG[item.category].emoji} {SECONDHAND_CATEGORY_CONFIG[item.category].label}
                </span>
                {item.area && item.area.length > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    <MapPin size={11} />{item.area.join('·')}
                  </span>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                  发布于 {new Date(item.created_at).toLocaleDateString('zh-CN')}
                </span>
              </div>

              {/* Description */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">物品描述</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>
              </div>
              <ViewCount type="secondhand" id={item.id} className="mt-3" />
            </motion.div>

            {/* Contact card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <h2 className="text-sm font-semibold text-gray-700 mb-4">联系卖家</h2>

              <div className="flex items-center gap-3 mb-4">
                <div
                  onClick={() => item.seller && navigate(`/provider/${item.seller.id}`)}
                  className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0
                             cursor-pointer ring-2 ring-primary-200 hover:ring-primary-400 transition-all"
                >
                  {item.seller?.avatar_url
                    ? <img src={item.seller.avatar_url} alt={item.contact_name}
                        className="w-full h-full rounded-full object-cover" />
                    : <User size={18} className="text-primary-600" />
                  }
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-1">{item.contact_name}</span>
                {item.seller && (
                  <button
                    onClick={() => navigate(`/provider/${item.seller!.id}`)}
                    className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold
                               bg-primary-50 hover:bg-primary-100 border border-primary-200
                               px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <ExternalLink size={12} />
                    查看主页
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <a href={`tel:${item.contact_phone}`}
                  className="flex-1 flex items-center justify-center gap-2
                             bg-primary-600 hover:bg-primary-700 active:scale-95
                             text-white text-sm font-semibold py-3 rounded-xl transition-all"
                >
                  <Phone size={16} />
                  {item.contact_phone}
                </a>
                {item.contact_wechat && (
                  <button onClick={copyWechat}
                    className="flex items-center justify-center gap-2
                               bg-green-500 hover:bg-green-600 active:scale-95
                               text-white text-sm font-semibold px-4 py-3 rounded-xl transition-all"
                  >
                    {copied ? <Copy size={16} /> : <MessageCircle size={16} />}
                    {copied ? '已复制' : '微信'}
                  </button>
                )}
              </div>

              {item.contact_wechat && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  微信号：{item.contact_wechat}
                </p>
              )}
            </motion.div>

            {/* CTA */}
            {(!user || user.id !== item.seller_id) && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-primary-50 border border-primary-100 rounded-2xl p-4 text-center"
              >
                <p className="text-sm text-primary-700 font-medium mb-2">有闲置要出售？</p>
                <button
                  onClick={() => user ? navigate('/secondhand/post') : navigate('/login')}
                  className="text-sm text-primary-600 font-semibold underline"
                >
                  免费发布闲置
                </button>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
