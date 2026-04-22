import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Check, ExternalLink, Pencil, Share2, Tag, X, AlignLeft } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useNavigate } from 'react-router-dom'
import MembershipBadge, { type MemberLevel } from '../../../components/MembershipBadge/MembershipBadge'

interface Profile {
  name: string
  avatar_url: string | null
  bio: string | null
  cover_url: string | null
  tags: string[]
  membership_level: MemberLevel
}

export default function HomepageSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [profile,      setProfile]      = useState<Profile | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [copied,       setCopied]       = useState(false)

  const [editingBio,  setEditingBio]  = useState(false)
  const [bioInput,    setBioInput]    = useState('')
  const [editingTags, setEditingTags] = useState(false)
  const [tagsInput,   setTagsInput]   = useState('')

  const coverRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('users')
      .select('name, avatar_url, bio, social_links, membership_level, membership_expires_at')
      .eq('id', user.id).single()
      .then(({ data }) => {
        if (!data) return
        const links = (data.social_links ?? {}) as Record<string, string>
        const expiry = data.membership_expires_at ? new Date(data.membership_expires_at) : null
        const isActive = !!(expiry && expiry > new Date())
        setProfile({
          name: data.name ?? '用户',
          avatar_url: data.avatar_url ?? null,
          bio: data.bio ?? null,
          cover_url: links['_cover'] ?? null,
          tags: links['_tags'] ? links['_tags'].split(',').map((t: string) => t.trim()).filter(Boolean) : [],
          membership_level: isActive ? (data.membership_level as MemberLevel) ?? 'L1' : 'L1',
        })
      })
  }, [user])

  if (!user || !profile) return null

  const profileUrl = `${window.location.origin}/provider/${user.id}`

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user!.id}/cover.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const coverUrl = publicUrl + '?t=' + Date.now()
      // Store in social_links._cover
      const { data: existing } = await supabase.from('users').select('social_links').eq('id', user!.id).single()
      const merged = { ...(existing?.social_links ?? {}), _cover: coverUrl }
      await supabase.from('users').update({ social_links: merged }).eq('id', user!.id)
      setProfile(p => p ? { ...p, cover_url: coverUrl } : p)
    } catch (err) {
      alert('封面上传失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setUploadingCover(false)
      if (coverRef.current) coverRef.current.value = ''
    }
  }

  async function saveBio() {
    setSaving(true)
    await supabase.from('users').update({ bio: bioInput.trim() }).eq('id', user!.id)
    setProfile(p => p ? { ...p, bio: bioInput.trim() } : p)
    setEditingBio(false)
    setSaving(false)
  }

  async function saveTags() {
    setSaving(true)
    const tags = tagsInput.split(/[,，]/).map(t => t.trim()).filter(Boolean)
    const { data: existing } = await supabase.from('users').select('social_links').eq('id', user!.id).single()
    const merged = { ...(existing?.social_links ?? {}), _tags: tags.join(',') }
    await supabase.from('users').update({ social_links: merged }).eq('id', user!.id)
    setProfile(p => p ? { ...p, tags } : p)
    setEditingTags(false)
    setSaving(false)
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('主页链接：' + profileUrl)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 px-4 py-6 max-w-md lg:max-w-none mx-auto w-full space-y-4"
    >
      {/* ── Preview card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Cover */}
        <div className="relative h-36 bg-gradient-to-br from-primary-400 to-primary-700">
          {profile.cover_url && (
            <img src={profile.cover_url} alt="封面" className="w-full h-full object-cover" />
          )}
          <button
            onClick={() => coverRef.current?.click()}
            disabled={uploadingCover}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/40 hover:bg-black/60
                       text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors"
          >
            <Camera size={13} />
            {uploadingCover ? '上传中…' : '更换封面'}
          </button>
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        </div>

        {/* Avatar + name */}
        <div className="px-5 pb-5">
          <div className="-mt-10 mb-3 flex items-end justify-between">
            <div className="w-20 h-20 rounded-full border-4 border-white shadow-md overflow-hidden bg-primary-100 flex items-center justify-center flex-shrink-0">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                : <span className="text-2xl font-bold text-primary-600">{profile.name.slice(0, 1)}</span>
              }
            </div>
            <div className="flex gap-2 mb-1">
              <button
                onClick={share}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
              >
                <Share2 size={13} />
                {copied ? '已复制！' : '分享主页'}
              </button>
              <button
                onClick={() => navigate(`/provider/${user.id}`)}
                className="flex items-center gap-1.5 bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded-full hover:bg-primary-700 transition-colors"
              >
                <ExternalLink size={13} />
                查看主页
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <p className="text-lg font-bold text-gray-900">{profile.name}</p>
            <MembershipBadge level={profile.membership_level} size="sm" />
          </div>

          {/* Bio preview */}
          {profile.bio
            ? <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{profile.bio}</p>
            : <p className="text-sm text-gray-400 italic">还没有简介，点下方编辑吧</p>
          }

          {/* Tags preview */}
          {profile.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.tags.map(t => (
                <span key={t} className="text-xs bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full font-medium">
                  # {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit bio ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <AlignLeft size={15} className="text-primary-400" />
              个人简介
            </div>
            {!editingBio && (
              <button onClick={() => { setBioInput(profile.bio ?? ''); setEditingBio(true) }}
                className="text-gray-400 hover:text-primary-600">
                <Pencil size={14} />
              </button>
            )}
          </div>
          {editingBio ? (
            <div>
              <textarea
                autoFocus rows={4} value={bioInput}
                onChange={e => setBioInput(e.target.value)}
                placeholder="介绍一下自己，让客户更了解你…"
                className="w-full text-sm border border-primary-200 rounded-xl px-3 py-2.5 outline-none resize-none focus:ring-2 focus:ring-primary-100"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={saveBio} disabled={saving}
                  className="flex items-center gap-1 text-xs text-white bg-primary-600 px-3 py-1.5 rounded-lg">
                  <Check size={12} /> 保存
                </button>
                <button onClick={() => setEditingBio(false)} className="flex items-center gap-1 text-xs text-gray-400">
                  <X size={12} /> 取消
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {profile.bio || <span className="text-gray-400 italic">未填写</span>}
            </p>
          )}
        </div>

        {/* Edit tags */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Tag size={15} className="text-primary-400" />
              个人标签
            </div>
            {!editingTags && (
              <button onClick={() => { setTagsInput(profile.tags.join('，')); setEditingTags(true) }}
                className="text-gray-400 hover:text-primary-600">
                <Pencil size={14} />
              </button>
            )}
          </div>
          {editingTags ? (
            <div>
              <input
                autoFocus value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="用逗号分隔，例如：翻译，导游，会计"
                className="w-full text-sm border border-primary-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-100"
              />
              <p className="text-xs text-gray-400 mt-1">用中英文逗号分隔，最多 6 个标签</p>
              <div className="flex gap-2 mt-2">
                <button onClick={saveTags} disabled={saving}
                  className="flex items-center gap-1 text-xs text-white bg-primary-600 px-3 py-1.5 rounded-lg">
                  <Check size={12} /> 保存
                </button>
                <button onClick={() => setEditingTags(false)} className="flex items-center gap-1 text-xs text-gray-400">
                  <X size={12} /> 取消
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {profile.tags.length > 0
                ? profile.tags.slice(0, 6).map(t => (
                    <span key={t} className="text-xs bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full font-medium">
                      # {t}
                    </span>
                  ))
                : <span className="text-sm text-gray-400 italic">未添加标签</span>
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Tips ─────────────────────────────────────────────────────────── */}
      <div className="bg-primary-50 rounded-2xl px-4 py-3 text-xs text-primary-600 leading-relaxed">
        💡 完善主页信息可以让客户更信任你，提高接单率。
        建议上传封面、填写简介并添加技能标签。
      </div>
    </motion.div>
  )
}
