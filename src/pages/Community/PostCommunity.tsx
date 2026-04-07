// ─── Post Community (小红书风格) ──────────────────────────────────────────────
// Route: /community/post
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ImagePlus, X, MapPin, Tag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { compressImage, validateImageFile } from '../../lib/compressImage'
import { POST_TYPE_CONFIG, AREA_CONFIG } from './CommunityPage'

const MAX_IMAGES = 4

export default function PostCommunity() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [title,        setTitle]        = useState('')
  const [content,      setContent]      = useState('')
  const [type,         setType]         = useState<string>('')        // optional
  const [area,         setArea]         = useState<string>('')        // optional
  const [images,       setImages]       = useState<File[]>([])
  const [previews,     setPreviews]     = useState<string[]>([])
  const [submitting,   setSubmitting]   = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [error,        setError]        = useState('')
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [showAreaPicker, setShowAreaPicker] = useState(false)

  if (!user) { navigate('/login'); return null }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''
    const remaining = MAX_IMAGES - images.length
    const toProcess = files.slice(0, remaining)
    for (const file of toProcess) {
      const err = validateImageFile(file)
      if (err) { setError(err); return }
    }
    setUploadingImg(true)
    const compressed = await Promise.all(toProcess.map(f => compressImage(f)))
    setImages(prev => [...prev, ...compressed])
    setPreviews(prev => [...prev, ...compressed.map(f => URL.createObjectURL(f))])
    setUploadingImg(false)
  }

  function removeImage(idx: number) {
    URL.revokeObjectURL(previews[idx])
    setImages(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function submit() {
    if (!title.trim()) { setError('请填写标题'); return }
    if (!content.trim()) { setError('请填写内容'); return }
    setError('')
    setSubmitting(true)

    const imageUrls: string[] = []
    for (const file of images) {
      const path = `community/${user!.id}/${Date.now()}-${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('service-images').upload(path, file, { upsert: true })
      if (uploadErr) { setError(`图片上传失败：${uploadErr.message}`); setSubmitting(false); return }
      const { data: urlData } = supabase.storage.from('service-images').getPublicUrl(path)
      imageUrls.push(urlData.publicUrl)
    }

    const { data, error: err } = await supabase
      .from('community_posts')
      .insert({
        author_id: user!.id,
        type:      type || 'question',
        area:      area || 'other',
        title:     title.trim(),
        content:   content.trim(),
        images:    imageUrls,
      })
      .select('id').single()

    setSubmitting(false)
    if (err || !data) { setError('发布失败，请重试'); return }
    navigate(`/community/${data.id}`)
  }

  const canSubmit = title.trim().length > 0 && content.trim().length > 0

  return (
    <div className="min-h-screen bg-white">

      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 p-1">
          <ArrowLeft size={22} />
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting || uploadingImg}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400
                     text-white text-sm font-bold px-5 py-2 rounded-full transition-colors"
        >
          {submitting ? '发布中…' : '发布'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32">

        {/* Image grid — 小红书风格，图片优先 */}
        <div className="mb-5">
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, idx) => (
              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removeImage(idx)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full
                             flex items-center justify-center hover:bg-black/70 transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50
                                flex flex-col items-center justify-center gap-1.5 cursor-pointer
                                hover:border-primary-300 hover:bg-primary-50 transition-all">
                <ImagePlus size={24} className="text-gray-300" />
                <span className="text-[11px] text-gray-400">{uploadingImg ? '处理中…' : images.length === 0 ? '添加图片' : '继续添加'}</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={handleImageChange} disabled={uploadingImg} />
              </label>
            )}
          </div>
          {images.length === 0 && (
            <p className="text-xs text-gray-400 mt-2 text-center">添加图片让帖子更吸引人（选填）</p>
          )}
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setError('') }}
          placeholder="写一个吸引人的标题…"
          maxLength={80}
          className="w-full text-lg font-semibold text-gray-900 placeholder-gray-300
                     outline-none border-none bg-transparent mb-1"
        />
        <div className="h-px bg-gray-100 mb-4" />

        {/* Content */}
        <textarea
          value={content}
          onChange={e => { setContent(e.target.value); setError('') }}
          placeholder="分享你的经验、问题或推荐…"
          rows={8}
          className="w-full text-sm text-gray-700 placeholder-gray-300
                     outline-none border-none bg-transparent resize-none leading-relaxed"
        />

        {/* Error */}
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>

      {/* Bottom bar: optional tags */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {/* Type tag */}
          <div className="relative">
            <button
              onClick={() => { setShowTypePicker(v => !v); setShowAreaPicker(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                          ${type ? 'bg-primary-50 border-primary-300 text-primary-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
            >
              <Tag size={12} />
              {type ? POST_TYPE_CONFIG[type]?.label : '帖子类型'}
            </button>
            {showTypePicker && (
              <div className="absolute bottom-10 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-48 z-20">
                <p className="text-xs text-gray-400 mb-2 px-1">选择类型（选填）</p>
                {[['', '不指定', '—'], ...Object.entries(POST_TYPE_CONFIG).map(([k, v]) => [k, v.label, v.emoji])].map(([key, label, emoji]) => (
                  <button key={key} onClick={() => { setType(key); setShowTypePicker(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors
                                ${type === key ? 'bg-primary-50 text-primary-600 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <span>{emoji}</span>{label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Area tag */}
          <div className="relative">
            <button
              onClick={() => { setShowAreaPicker(v => !v); setShowTypePicker(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                          ${area ? 'bg-primary-50 border-primary-300 text-primary-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
            >
              <MapPin size={12} />
              {area ? AREA_CONFIG[area] : '所在区域'}
            </button>
            {showAreaPicker && (
              <div className="absolute bottom-10 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-44 z-20">
                <p className="text-xs text-gray-400 mb-2 px-1">选择地区（选填）</p>
                {[['', '不指定'], ...Object.entries(AREA_CONFIG)].map(([key, label]) => (
                  <button key={key} onClick={() => { setArea(key); setShowAreaPicker(false) }}
                    className={`w-full flex items-center px-3 py-2 rounded-xl text-sm transition-colors text-left
                                ${area === key ? 'bg-primary-50 text-primary-600 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="ml-auto text-xs text-gray-300">{title.length}/80</span>
        </div>
      </div>
    </div>
  )
}
