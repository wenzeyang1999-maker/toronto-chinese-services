// ─── Profile Page ─────────────────────────────────────────────────────────────
// Mobile  (< lg): menu slides in/out, section replaces it fullscreen
// Desktop (≥ lg): fixed left sidebar + scrollable right content panel
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Camera, LogOut,
  ShieldCheck, Briefcase, Clock, MessageSquare, Bot, BadgeCheck, Crown, Heart, UserCheck, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import type { BrowseEntry, ChatSession, Section } from './types'
import type { MemberLevel } from '../../components/MembershipBadge/MembershipBadge'
import MembershipBadge from '../../components/MembershipBadge/MembershipBadge'
import AccountSection      from './sections/AccountSection'
import ServicesSection     from './sections/ServicesSection'
import SavesSection        from './sections/SavesSection'
import BrowseSection       from './sections/BrowseSection'
import ChatSection         from './sections/ChatSection'
import MessagesSection     from './sections/MessagesSection'
import VerificationSection from './sections/VerificationSection'
import MembershipSection   from './sections/MembershipSection'
import FollowsSection      from './sections/FollowsSection'
import StatsSection        from './sections/StatsSection'

const MENU: { key: Section; icon: React.ReactNode; label: string; sub: string }[] = [
  { key: 'account',      icon: <ShieldCheck   size={18} />, label: '帐号和安全',        sub: '个人信息、密码修改' },
  { key: 'verification', icon: <BadgeCheck    size={18} />, label: '联系方式与资质验证', sub: '社交媒体、手机验证、商户认证' },
  { key: 'membership',   icon: <Crown         size={18} />, label: '会员等级',           sub: '查看商家会员权益' },
  { key: 'services',     icon: <Briefcase     size={18} />, label: '我的发布',           sub: '服务·招聘·房源·闲置·活动' },
  { key: 'saves',        icon: <Heart         size={18} />, label: '我的收藏',           sub: '已收藏的服务、招聘、房源等' },
  { key: 'follows',      icon: <UserCheck     size={18} />, label: '我的关注',           sub: '已关注的服务商' },
  { key: 'stats',        icon: <TrendingUp    size={18} />, label: '数据面板',            sub: '浏览·收藏·消息·评价统计' },
  { key: 'messages',     icon: <MessageSquare size={18} />, label: '我的消息',           sub: '与商家的对话记录' },
  { key: 'browse',       icon: <Clock         size={18} />, label: '浏览记录',           sub: '最近查看的服务' },
  { key: 'chat',         icon: <Bot           size={18} />, label: 'AI 对话记录',        sub: '历史聊天记录' },
]

export default function Profile() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user     = useAuthStore((s) => s.user)

  const VALID_SECTIONS = ['account','verification','membership','services','saves','follows','stats','messages','browse','chat']

  const [section, setSection] = useState<Section | null>(() => {
    const param = searchParams.get('section') as Section | null
    if (param && VALID_SECTIONS.includes(param)) return param
    return typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'account' : null
  })

  // React to URL param changes while Profile is already mounted
  // (e.g. clicking the floating Messages button when already on /profile)
  useEffect(() => {
    const param = searchParams.get('section') as Section | null
    if (param && VALID_SECTIONS.includes(param)) {
      setSection(param)
    }
  }, [searchParams])
  const [name,            setName]            = useState('')
  const [phone,           setPhone]           = useState('')
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null)
  const [memberLevel,     setMemberLevel]     = useState<MemberLevel>('L1')
  const [uploading,       setUploading]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [browse, setBrowse] = useState<BrowseEntry[]>([])
  const [chats,  setChats]  = useState<ChatSession[]>([])

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name, phone, avatar_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setName(data.name ?? user.user_metadata?.name ?? '用户')
          setPhone(data.phone ?? user.user_metadata?.phone ?? '')
          setAvatarUrl(data.avatar_url ?? null)
        }
      })
    // Fetch membership_level separately (new column — skip silently if not migrated yet)
    supabase.from('users').select('membership_level').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.membership_level) setMemberLevel(data.membership_level as MemberLevel)
      })
try { setBrowse(JSON.parse(localStorage.getItem('tcs_browse_history') ?? '[]')) } catch { /* */ }
    try { setChats(JSON.parse(localStorage.getItem('tcs_chat_history')   ?? '[]')) } catch { /* */ }
  }, [user])

  if (!user) return null

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `${user!.id}/avatar.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user!.id)
      setAvatarUrl(publicUrl + '?t=' + Date.now())
    } catch (err) {
      alert('头像上传失败：' + (err instanceof Error ? err.message : '请先创建 avatars 存储桶'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Sidebar contents (shared between mobile menu + desktop sidebar) ──────────
  const SidebarInner = ({ compact = false }: { compact?: boolean }) => (
    <div className={`space-y-5 ${compact ? '' : 'px-4 py-6 max-w-md mx-auto w-full'}`}>
      {/* Avatar card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-[68px] h-[68px] rounded-full overflow-hidden bg-primary-100 flex items-center justify-center">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-primary-600">{name.slice(0, 1)}</span>
            }
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center shadow-md hover:bg-primary-700 transition-colors disabled:opacity-60">
            <Camera size={13} className="text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-gray-900 truncate">{name}</p>
            <MembershipBadge level={memberLevel} size="sm" />
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
        </div>
      </div>

      {/* Menu items */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
        {MENU.map(item => {
          const active = section === item.key
          return (
            <button key={item.key} onClick={() => setSection(item.key)}
              className={`w-full flex items-center gap-4 px-5 py-4 transition-colors text-left
                ${active
                  ? 'bg-primary-50 hover:bg-primary-50'
                  : 'hover:bg-gray-50 active:bg-gray-100'}`}
            >
              <span className={`flex-shrink-0 ${active ? 'text-primary-600' : 'text-primary-400'}`}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${active ? 'text-primary-700' : 'text-gray-800'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
              </div>
              <ChevronRight size={16} className={active ? 'text-primary-400' : 'text-gray-300'} />
            </button>
          )
        })}
      </div>

      {/* Logout */}
      <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }}
        className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200
                   text-red-500 rounded-2xl py-3.5 text-sm font-medium hover:bg-red-50
                   transition-colors shadow-sm">
        <LogOut size={16} />
        退出登录
      </button>
    </div>
  )

  // ── Section content renderer ─────────────────────────────────────────────────
  function renderSection(key: Section | null) {
    switch (key) {
      case 'account':      return <AccountSection user={user!} name={name} phone={phone} onNameChange={setName} onPhoneChange={setPhone} />
      case 'verification': return <VerificationSection user={user!} />
      case 'membership':   return <MembershipSection level={memberLevel} />
      case 'services':     return <ServicesSection />
      case 'saves':        return <SavesSection />
      case 'follows':      return <FollowsSection />
      case 'stats':        return <StatsSection />
      case 'messages':     return <MessagesSection />
      case 'browse':       return <BrowseSection items={browse} onClear={() => { localStorage.removeItem('tcs_browse_history'); setBrowse([]) }} />
      case 'chat':         return <ChatSection sessions={chats} onClear={() => { localStorage.removeItem('tcs_chat_history'); setChats([]) }} />
      default:             return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white border-b-2 border-gray-200 px-4 h-14 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={() => section ? setSection(null) : navigate(-1)}
          className="text-gray-500 hover:text-gray-800 lg:hidden"
        >
          <ChevronLeft size={22} />
        </button>
        <button onClick={() => navigate(-1)} className="hidden lg:block text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800 lg:hidden">
          {section ? MENU.find(m => m.key === section)?.label : '我的账号'}
        </span>
        <span className="hidden lg:block font-semibold text-gray-800">我的账号</span>
      </div>

      {/* ── DESKTOP layout ──────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <aside className="w-96 flex-shrink-0 border-r-2 border-gray-200 bg-white overflow-y-auto shadow-[2px_0_8px_0_rgba(0,0,0,0.04)]">
          <div className="p-8">
            <SidebarInner compact />
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="py-6 px-4">
            {renderSection(section ?? 'account')}
          </div>
        </main>
      </div>

      {/* ── MOBILE layout ───────────────────────────────────────────────────── */}
      <div className="lg:hidden flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {!section && (
            <motion.div key="menu"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
              className="flex-1"
            >
              <SidebarInner />
            </motion.div>
          )}
          {section && (
            <motion.div key={section}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {renderSection(section)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}
