import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Camera, Check, ExternalLink, Pencil, Share2, Tag, X,
  AlignLeft, Wifi, WifiOff, Briefcase, Building2, User,
  Plus, ImagePlus, ShieldCheck, Link2,
} from 'lucide-react'
import { SOCIAL_PLATFORMS } from '../../../lib/socialPlatforms'
import { cropAndCompressImage, compressImage, validateImageFile } from '../../../lib/compressImage'
import { supabase } from '../../../lib/supabase'
import { offsetLocation } from '../../../lib/geo'
import { useAuthStore } from '../../../store/authStore'
import { useNavigate } from 'react-router-dom'
import MembershipBadge, { type MemberLevel } from '../../../components/MembershipBadge/MembershipBadge'
import ServicesSection from './ServicesSection'
import CommunitySection from './CommunitySection'
import StatsSection from './StatsSection'
import SavesSection from './SavesSection'
import FollowsSection from './FollowsSection'
import BrowseSection from './BrowseSection'
import type { BrowseEntry } from '../types'
import { toast } from '../../../lib/toast'

type Tab = 'edit' | 'services' | 'community' | 'stats' | 'saves' | 'follows' | 'browse'

const TABS: { key: Tab; label: string }[] = [
  { key: 'edit',      label: '编辑主页' },
  { key: 'services',  label: '📦 我的发布' },
  { key: 'community', label: '💬 我的帖子' },
  { key: 'stats',     label: '📊 数据面板' },
  { key: 'saves',     label: '❤️ 我的收藏' },
  { key: 'follows',   label: '👤 我的关注' },
  { key: 'browse',    label: '🕐 浏览记录' },
]

interface Profile {
  name: string
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  business_type: 'individual' | 'business'
  skill_tags: string[]
  qualification_note: string
  qualification_images: string[]
  membership_level: MemberLevel
  is_online: boolean
  socialLinks: Record<string, string>
}

const MAX_QUAL_IMAGES = 8

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
  )
}

export default function HomepageSection() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [tab,             setTab]             = useState<Tab>('edit')
  const [profile,         setProfile]         = useState<Profile | null>(null)
  const [saving,          setSaving]          = useState(false)
  const [uploadingCover,  setUploadingCover]  = useState(false)
  const [copied,          setCopied]          = useState(false)
  const [togglingOnline,  setTogglingOnline]  = useState(false)

  // Bio
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput,   setBioInput]   = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState('')

  // Skill tags
  const [editingTags, setEditingTags] = useState(false)
  const [tagInput,    setTagInput]    = useState('')  // current chip being typed
  const [draftTags,   setDraftTags]   = useState<string[]>([])

  // Qualification & equipment (merged: free-text note + photo gallery)
  const [editingQualNote, setEditingQualNote] = useState(false)
  const [qualNoteInput,   setQualNoteInput]   = useState('')
  const [uploadingQual,   setUploadingQual]   = useState(false)

  // Social links
  const [editingSocial, setEditingSocial] = useState(false)
  const [socialDraft,   setSocialDraft]   = useState<Record<string, string>>({})

  const coverRef = useRef<HTMLInputElement>(null)
  const qualRef  = useRef<HTMLInputElement>(null)

  // Browse history (for the 浏览记录 tab) — read from localStorage
  const [browse, setBrowse] = useState<BrowseEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('tcs_browse_history') ?? '[]') }
    catch { return [] }
  })

  useEffect(() => {
    if (!user) return
    supabase.from('users')
      .select('name, avatar_url, bio, social_links, membership_level, membership_expires_at, is_online, business_type, skill_tags, qualification_note, qualification_images')
      .eq('id', user.id).single()
      .then(({ data }) => {
        if (!data) return
        const links  = (data.social_links ?? {}) as Record<string, string>
        const expiry = data.membership_expires_at ? new Date(data.membership_expires_at) : null
        const isActive = !!(expiry && expiry > new Date())
        setProfile({
          name:           data.name ?? '用户',
          avatar_url:     data.avatar_url ?? null,
          cover_url:      links['_cover'] ?? null,
          bio:            data.bio ?? null,
          business_type:  (data.business_type ?? 'individual') as 'individual' | 'business',
          skill_tags:     data.skill_tags ?? [],
          qualification_note:   data.qualification_note ?? '',
          qualification_images: (data.qualification_images ?? []) as string[],
          membership_level: isActive ? (data.membership_level as MemberLevel) ?? 'L1' : 'L1',
          is_online:      data.is_online ?? false,
          socialLinks:    Object.fromEntries(Object.entries(links).filter(([k]) => k !== '_cover')),
        })
      })
  }, [user])

  if (!user || !profile) return null

  const profileUrl = `${window.location.origin}/provider/${user.id}`

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    try {
      const compressed = await cropAndCompressImage(file, 3)
      const path = `${user!.id}/cover.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const coverUrl = publicUrl + '?t=' + Date.now()
      const { data: existing } = await supabase.from('users').select('social_links').eq('id', user!.id).single()
      const merged = { ...(existing?.social_links ?? {}), _cover: coverUrl }
      await supabase.from('users').update({ social_links: merged }).eq('id', user!.id)
      setProfile(p => p ? { ...p, cover_url: coverUrl } : p)
    } catch (err) {
      toast('封面上传失败：' + (err instanceof Error ? err.message : '未知错误'), 'error')
    } finally {
      setUploadingCover(false)
      if (coverRef.current) coverRef.current.value = ''
    }
  }

  async function saveBusinessType(type: 'individual' | 'business') {
    await supabase.from('users').update({ business_type: type }).eq('id', user!.id)
    setProfile(p => p ? { ...p, business_type: type } : p)
  }

  async function saveName() {
    const v = nameInput.trim()
    if (!v) { toast('名字不能为空', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('users').update({ name: v }).eq('id', user!.id)
    setSaving(false)
    if (error) { toast('保存失败：' + error.message, 'error'); return }
    setProfile(p => p ? { ...p, name: v } : p)
    setEditingName(false)
  }

  async function saveBio() {
    setSaving(true)
    await supabase.from('users').update({ bio: bioInput.trim() }).eq('id', user!.id)
    setProfile(p => p ? { ...p, bio: bioInput.trim() } : p)
    setEditingBio(false)
    setSaving(false)
  }

  function addTag() {
    const t = tagInput.trim()
    if (!t || draftTags.includes(t) || draftTags.length >= 12) return
    setDraftTags(prev => [...prev, t])
    setTagInput('')
  }

  async function saveTags() {
    setSaving(true)
    await supabase.from('users').update({ skill_tags: draftTags }).eq('id', user!.id)
    setProfile(p => p ? { ...p, skill_tags: draftTags } : p)
    setEditingTags(false)
    setSaving(false)
  }

  async function saveQualNote() {
    setSaving(true)
    const note = qualNoteInput.trim()
    await supabase.from('users').update({ qualification_note: note }).eq('id', user!.id)
    setProfile(p => p ? { ...p, qualification_note: note } : p)
    setEditingQualNote(false)
    setSaving(false)
  }

  async function saveSocial() {
    setSaving(true)
    const { data: existing } = await supabase.from('users').select('social_links').eq('id', user!.id).single()
    const cover = (existing?.social_links as Record<string, string>)?.['_cover']
    const merged: Record<string, string> = { ...(cover ? { _cover: cover } : {}) }
    for (const [k, v] of Object.entries(socialDraft)) {
      if (v.trim()) merged[k] = v.trim()
    }
    await supabase.from('users').update({ social_links: merged }).eq('id', user!.id)
    const newLinks = Object.fromEntries(Object.entries(merged).filter(([k]) => k !== '_cover'))
    setProfile(p => p ? { ...p, socialLinks: newLinks } : p)
    setEditingSocial(false)
    setSaving(false)
  }

  async function handleQualUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || !profile) return

    const remaining = MAX_QUAL_IMAGES - profile.qualification_images.length
    const toProcess = files.slice(0, remaining)
    for (const f of toProcess) {
      const err = validateImageFile(f)
      if (err) { toast(err, 'error'); return }
    }

    setUploadingQual(true)
    try {
      const uploaded: string[] = []
      for (const file of toProcess) {
        const compressed = await compressImage(file)
        const path = `qualifications/${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        const { error } = await supabase.storage.from('service-images').upload(path, compressed, { upsert: false })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('service-images').getPublicUrl(path)
        uploaded.push(publicUrl)
      }
      const next = [...profile.qualification_images, ...uploaded]
      await supabase.from('users').update({ qualification_images: next }).eq('id', user!.id)
      setProfile(p => p ? { ...p, qualification_images: next } : p)
    } catch (err) {
      toast('图片上传失败：' + (err instanceof Error ? err.message : '请重试'), 'error')
    } finally {
      setUploadingQual(false)
    }
  }

  async function removeQualImage(idx: number) {
    if (!profile) return
    const next = profile.qualification_images.filter((_, i) => i !== idx)
    await supabase.from('users').update({ qualification_images: next }).eq('id', user!.id)
    setProfile(p => p ? { ...p, qualification_images: next } : p)
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('主页链接已复制 ✓', 'success')
    }
  }

  async function toggleOnline() {
    if (!user || !profile) return
    setTogglingOnline(true)
    const next = !profile.is_online
    let lat: number | null = null
    let lng: number | null = null

    if (next) {
      try {
        const pos = await getCurrentPosition()
        // Privacy: the online pin is publicly readable — never store the raw
        // device GPS (often a home address). Fuzz it 300–900m like demand pins.
        const fuzzed = offsetLocation(pos.coords.latitude, pos.coords.longitude)
        lat = fuzzed.lat
        lng = fuzzed.lng
      } catch {
        toast('无法获取位置，上线后地图上不会显示你的位置', 'info')
      }
    }

    const { error } = await supabase.from('users').update({
      is_online:  next,
      online_lat: next ? lat : null,
      online_lng: next ? lng : null,
      last_seen_at: new Date().toISOString(),
    }).eq('id', user.id)

    if (!error) setProfile(p => p ? { ...p, is_online: next } : p)
    setTogglingOnline(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 w-full"
    >
      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-0 max-w-md lg:max-w-none mx-auto">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm mb-4 overflow-visible">

          {/* Cover */}
          <div className="relative h-40 bg-gradient-to-br from-primary-400 to-primary-700 rounded-t-3xl overflow-hidden">
            {profile.cover_url && <img loading="lazy" src={profile.cover_url} alt="封面" className="w-full h-full object-cover" />}
            <button onClick={() => coverRef.current?.click()} disabled={uploadingCover}
              className="absolute bottom-3 right-4 flex items-center gap-1.5 bg-black/40 hover:bg-black/60
                         text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors">
              <Camera size={13} />
              {uploadingCover ? '上传中…' : '更换封面'}
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </div>

          {/* Avatar row */}
          <div className="px-5 -mt-10 flex items-end justify-between">
            <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-primary-100 flex items-center justify-center flex-shrink-0 relative z-10">
              {profile.avatar_url
                ? <img loading="lazy" src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                : <span className="text-2xl font-bold text-primary-600">{profile.name.slice(0, 1)}</span>}
            </div>
            <div className="flex gap-2 mb-1">
              <button onClick={share}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-full hover:bg-gray-50 transition-colors">
                <Share2 size={13} />
                {copied ? '已复制' : '分享'}
              </button>
              <button onClick={() => navigate(`/provider/${user.id}`)}
                className="flex items-center gap-1.5 bg-primary-600 text-white text-xs font-semibold px-3 py-2 rounded-full hover:bg-primary-700 transition-colors shadow-sm">
                <ExternalLink size={13} />
                查看主页
              </button>
            </div>
          </div>

          {/* Name / type badge / bio / tags */}
          <div className="px-5 pt-3 pb-5">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-lg font-bold text-gray-900">{profile.name}</p>
              <MembershipBadge level={profile.membership_level} size="sm" />
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                profile.business_type === 'business'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {profile.business_type === 'business' ? '🏢 企业' : '👤 个人'}
              </span>
              {profile.is_online && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  在线接单
                </span>
              )}
            </div>

            {profile.bio
              ? <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{profile.bio}</p>
              : <p className="text-sm text-gray-400 italic">还没有简介，点击「编辑主页」填写吧</p>
            }
            {profile.skill_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.skill_tags.map(t => (
                  <span key={t} className="text-sm bg-primary-100 text-primary-700 px-3.5 py-1.5 rounded-full font-semibold">
                    # {t}
                  </span>
                ))}
              </div>
            )}
            {profile.qualification_images.length > 0 && (
              <div className="mt-2">
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1">
                  <ShieldCheck size={10} /> {profile.qualification_images.length} 张资质图
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-10 bg-gray-50 border-b border-gray-200 px-4">
        <div className="max-w-md lg:max-w-none mx-auto flex gap-1 overflow-x-auto scrollbar-hide py-2">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Edit tab ─────────────────────────────────────────────────────── */}
      {tab === 'edit' && (
        <div className="px-4 py-4 max-w-md lg:max-w-none mx-auto space-y-3">

          {/* ① 上线接单 */}
          <button onClick={toggleOnline} disabled={togglingOnline}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold transition-all active:scale-[0.98] disabled:opacity-60 shadow-sm ${
              profile.is_online
                ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200'
            }`}>
            {togglingOnline
              ? <span className="text-sm">定位中…</span>
              : profile.is_online
                ? <><WifiOff size={20} />我下线休息</>
                : <><Wifi size={20} />上线接单（显示到地图）</>
            }
          </button>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">

            {/* ① 名字 / 昵称 */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <User size={15} className="text-primary-400" />
                  名字 / 昵称
                </div>
                {!editingName && (
                  <button onClick={() => { setNameInput(profile.name); setEditingName(true) }}
                    className="text-gray-400 hover:text-primary-600"><Pencil size={14} /></button>
                )}
              </div>
              {editingName ? (
                <div>
                  <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    maxLength={30}
                    placeholder="你的称呼"
                    className="w-full text-sm border border-primary-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-100" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveName} disabled={saving}
                      className="flex items-center gap-1 text-xs text-white bg-primary-600 px-3 py-1.5 rounded-lg disabled:opacity-60">
                      <Check size={12} /> 保存
                    </button>
                    <button onClick={() => setEditingName(false)} className="flex items-center gap-1 text-xs text-gray-400">
                      <X size={12} /> 取消
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-800">{profile.name}</p>
              )}
            </div>

            {/* ② 自雇/企业 */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <Briefcase size={15} className="text-primary-400" />
                身份类型
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => saveBusinessType('individual')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    profile.business_type === 'individual'
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}>
                  <User size={15} /> 个人 / 自雇
                </button>
                <button
                  onClick={() => saveBusinessType('business')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    profile.business_type === 'business'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}>
                  <Building2 size={15} /> 企业
                </button>
              </div>
            </div>

            {/* ③ 自我简介 */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <AlignLeft size={15} className="text-primary-400" />
                  自我简介
                </div>
                {!editingBio && (
                  <button onClick={() => { setBioInput(profile.bio ?? ''); setEditingBio(true) }}
                    className="text-gray-400 hover:text-primary-600"><Pencil size={14} /></button>
                )}
              </div>
              {editingBio ? (
                <div>
                  <textarea autoFocus rows={4} value={bioInput} onChange={e => setBioInput(e.target.value)}
                    placeholder="介绍你的技能、经验和服务特色，让客户更了解你…"
                    className="w-full text-sm border border-primary-200 rounded-xl px-3 py-2.5 outline-none resize-none focus:ring-2 focus:ring-primary-100" />
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

            {/* ④ 技能标签 */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Tag size={15} className="text-primary-400" />
                  技能标签
                  <span className="text-xs text-gray-400 font-normal">（AI 搜索关键词）</span>
                </div>
                {!editingTags && (
                  <button onClick={() => { setDraftTags(profile.skill_tags); setEditingTags(true) }}
                    className="text-gray-400 hover:text-primary-600"><Pencil size={14} /></button>
                )}
              </div>
              {editingTags ? (
                <div className="space-y-2">
                  {/* Existing chips */}
                  <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                    {draftTags.map(t => (
                      <span key={t} className="flex items-center gap-1 text-xs bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full font-medium">
                        # {t}
                        <button onClick={() => setDraftTags(prev => prev.filter(x => x !== t))} className="hover:text-red-500">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* Add new tag */}
                  {draftTags.length < 12 && (
                    <div className="flex gap-2">
                      <input
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                        placeholder="输入标签，回车添加"
                        className="flex-1 text-sm border border-primary-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-100"
                      />
                      <button onClick={addTag}
                        className="px-3 py-2 bg-primary-600 text-white rounded-xl text-xs font-semibold">
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">最多 12 个标签，客户搜索你的技能时优先命中</p>
                  <div className="flex gap-2">
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
                  {profile.skill_tags.length > 0
                    ? profile.skill_tags.map(t => (
                        <span key={t} className="text-xs bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full font-medium">
                          # {t}
                        </span>
                      ))
                    : <span className="text-sm text-gray-400 italic">未添加标签，添加后客户可以通过搜索找到你</span>
                  }
                </div>
              )}
            </div>

            {/* ⑤ 资质与设备 — 文字说明 + 图片（合并）*/}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <ShieldCheck size={15} className="text-emerald-500" />
                  资质与设备
                </div>
                {!editingQualNote && (
                  <button onClick={() => { setQualNoteInput(profile.qualification_note); setEditingQualNote(true) }}
                    className="text-gray-400 hover:text-primary-600"><Pencil size={14} /></button>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3">
                写一句资质说明，并上传营业执照、证书、车队/设备照片，客户能在你主页直接看到（最多 {MAX_QUAL_IMAGES} 张）
              </p>
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>
                <p className="text-xs leading-relaxed text-amber-700">
                  <span className="font-semibold">这些图片会公开显示在主页。</span>
                  请勿上传身份证、护照等隐私证件；如传营业执照，建议先给
                  <span className="font-semibold">身份证号、住址、签名</span>等打码。
                </p>
              </div>

              {/* Text note */}
              {editingQualNote ? (
                <div className="mb-3">
                  <textarea
                    value={qualNoteInput}
                    onChange={e => setQualNoteInput(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="例：持有 XX 牌照、XX 保险，从业 8 年；货车 2 辆、专业打包工具齐全"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none resize-none focus:ring-1 focus:ring-primary-300"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button onClick={saveQualNote} disabled={saving}
                      className="flex items-center gap-1 text-xs text-white bg-primary-600 px-3 py-1.5 rounded-lg">
                      <Check size={12} /> 保存
                    </button>
                    <button onClick={() => setEditingQualNote(false)} className="flex items-center gap-1 text-xs text-gray-400">
                      <X size={12} /> 取消
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm mb-3 whitespace-pre-wrap">
                  {profile.qualification_note.trim()
                    ? <span className="text-gray-700">{profile.qualification_note}</span>
                    : <span className="text-gray-400 italic">未填写资质说明，填写可提高客户信任度</span>}
                </p>
              )}

              {/* Image grid */}
              <div className="grid grid-cols-3 gap-2">
                {profile.qualification_images.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img loading="lazy" src={url} alt={`资质 ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeQualImage(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/55 rounded-full flex items-center justify-center
                                 text-white hover:bg-red-500 transition-colors"
                      aria-label="删除"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {profile.qualification_images.length < MAX_QUAL_IMAGES && (
                  <button
                    onClick={() => qualRef.current?.click()}
                    disabled={uploadingQual}
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-300 bg-gray-50
                               flex flex-col items-center justify-center gap-1
                               text-gray-400 hover:border-emerald-400 hover:text-emerald-500
                               transition-colors disabled:opacity-50"
                  >
                    <ImagePlus size={20} />
                    <span className="text-[10px]">{uploadingQual ? '上传中…' : '添加图片'}</span>
                  </button>
                )}
              </div>
              <input ref={qualRef} type="file" accept="image/*" multiple className="hidden"
                onChange={handleQualUpload} />
            </div>

            {/* ⑥ 社交媒体 */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Link2 size={15} className="text-primary-400" />
                  社交媒体
                  <span className="text-xs text-gray-400 font-normal">（显示在你的公开主页）</span>
                </div>
                {!editingSocial && (
                  <button onClick={() => { setSocialDraft({ ...profile.socialLinks }); setEditingSocial(true) }}
                    className="text-gray-400 hover:text-primary-600"><Pencil size={14} /></button>
                )}
              </div>
              {editingSocial ? (
                <div className="space-y-2">
                  {SOCIAL_PLATFORMS.map(p => (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className="text-base w-5 text-center shrink-0">{p.icon}</span>
                      <span className="text-xs text-gray-500 w-[4.5rem] shrink-0">{p.label}</span>
                      <input
                        value={socialDraft[p.key] ?? ''}
                        onChange={e => setSocialDraft(d => ({ ...d, [p.key]: e.target.value }))}
                        placeholder={p.key === 'xiaohongshu' ? '主页完整链接' : p.key === 'whatsapp' ? '手机号（含国家码）' : '用户名或链接'}
                        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary-300"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveSocial} disabled={saving}
                      className="flex items-center gap-1 text-xs text-white bg-primary-600 px-3 py-1.5 rounded-lg">
                      <Check size={12} /> 保存
                    </button>
                    <button onClick={() => setEditingSocial(false)}
                      className="flex items-center gap-1 text-xs text-gray-400">
                      <X size={12} /> 取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_PLATFORMS.some(p => profile.socialLinks[p.key]?.trim()) ? (
                    SOCIAL_PLATFORMS.filter(p => profile.socialLinks[p.key]?.trim()).map(p => (
                      <span key={p.key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${p.color}`}>
                        {p.icon} {p.label}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400 italic">未填写，添加后客户可在你主页直接跳转</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-primary-50 rounded-2xl px-4 py-3 text-xs text-primary-600 leading-relaxed">
            💡 技能标签会被 AI 抓取并用于搜索匹配，建议用中英文都填写，例如"翻译 translation 日语"
          </div>
        </div>
      )}

      {tab === 'services'  && <div className="scroll-mt-28"><ServicesSection /></div>}
      {tab === 'community' && <div className="scroll-mt-28"><CommunitySection /></div>}
      {tab === 'stats'     && <div className="scroll-mt-28"><StatsSection /></div>}
      {tab === 'saves'     && <div className="scroll-mt-28 px-4 py-4 max-w-md lg:max-w-none mx-auto"><SavesSection /></div>}
      {tab === 'follows'   && <div className="scroll-mt-28 px-4 py-4 max-w-md lg:max-w-none mx-auto"><FollowsSection /></div>}
      {tab === 'browse'    && (
        <div className="scroll-mt-28 px-4 py-4 max-w-md lg:max-w-none mx-auto">
          <BrowseSection
            items={browse}
            onClear={() => { localStorage.removeItem('tcs_browse_history'); setBrowse([]) }}
          />
        </div>
      )}
    </motion.div>
  )
}
