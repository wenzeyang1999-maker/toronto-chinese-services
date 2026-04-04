// ─── Post Community ────────────────────────────────────────────────────────────
// Route: /community/post
// Create a new community post
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { POST_TYPE_CONFIG, AREA_CONFIG } from './CommunityPage'

export default function PostCommunity() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [type,      setType]      = useState<string>('question')
  const [area,      setArea]      = useState<string>('other')
  const [title,     setTitle]     = useState('')
  const [content,   setContent]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,     setError]     = useState('')

  if (!user) { navigate('/login'); return null }

  async function submit() {
    if (!title.trim()) { setError('请填写标题'); return }
    if (!content.trim()) { setError('请填写内容'); return }
    setError('')
    setSubmitting(true)

    const { data, error: err } = await supabase
      .from('community_posts')
      .insert({ author_id: user!.id, type, area, title: title.trim(), content: content.trim() })
      .select('id')
      .single()

    setSubmitting(false)
    if (err || !data) { setError('发布失败，请重试'); return }
    navigate(`/community/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft size={22} />
        </button>
        <span className="flex-1 text-sm font-semibold text-gray-800">发布帖子</span>
        <button onClick={submit} disabled={submitting}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300
                     text-white text-sm font-semibold px-4 py-1.5 rounded-full transition-colors">
          {submitting ? '发布中…' : '发布'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Type */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">帖子类型</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(POST_TYPE_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => setType(key)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all
                            ${type === key ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                <span className="text-lg">{cfg.emoji}</span>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Area */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">所在区域</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(AREA_CONFIG).map(([key, label]) => (
              <button key={key} onClick={() => setArea(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                            ${area === key ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">标题</p>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="一句话描述你的问题或分享…"
            maxLength={80}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800
                       placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/80</p>
        </div>

        {/* Content */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">内容</p>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="详细描述一下…"
            rows={6}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800
                       placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      </div>
    </div>
  )
}
