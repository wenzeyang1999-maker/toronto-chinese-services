// ─── Profile Page ─────────────────────────────────────────────────────────────
// Mobile  (< lg): menu slides in/out, section replaces it fullscreen
// Desktop (≥ lg): fixed left sidebar + scrollable right content panel
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Camera, LogOut,
  ShieldCheck, Clock, MessageSquare, BadgeCheck, Crown, Heart, UserCheck, Gift, LayoutDashboard, ClipboardList, Store, Calendar, User as UserIcon, RefreshCw,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { offsetLocation } from '../../lib/geo'
import { useAuthStore } from '../../store/authStore'
import { useLeadAlertsStore } from '../../store/leadAlertsStore'
import { useOnlineModeStore } from '../../store/onlineModeStore'
import { compressImage } from '../../lib/compressImage'
import { moderateImage } from '../../lib/moderateImage'
import type { BrowseEntry, Section } from './types'
import type { MemberLevel } from '../../components/MembershipBadge/MembershipBadge'
import MembershipBadge from '../../components/MembershipBadge/MembershipBadge'
import AccountSection      from './sections/AccountSection'
import ServicesSection     from './sections/ServicesSection'
import SavesSection        from './sections/SavesSection'
import BrowseSection       from './sections/BrowseSection'
import MessagesSection     from './sections/MessagesSection'
import VerificationSection from './sections/VerificationSection'
import MembershipSection   from './sections/MembershipSection'
import FollowsSection      from './sections/FollowsSection'
import StatsSection        from './sections/StatsSection'
import CommunitySection    from './sections/CommunitySection'
import ReferralSection     from './sections/ReferralSection'
import HomepageSection    from './sections/HomepageSection'
import TransactionsSection     from './sections/TransactionsSection'
import NotificationsSection    from './sections/NotificationsSection'
import MyEventsSection          from './sections/MyEventsSection'
import { toast } from '../../lib/toast'
import InstallAppButton from '../../components/InstallAppButton/InstallAppButton'
import ContactUsButton from '../../components/ContactUsButton/ContactUsButton'
import CreditStars from '../../components/CreditStars/CreditStars'

type MenuItem = { key: Section; icon: React.ReactNode; label: string; sub: string; modes: ('client' | 'provider')[] }

const MENU: MenuItem[] = [
  { key: 'homepage',     icon: <LayoutDashboard size={18} />, label: '我的主页',         sub: '封面 · 简介 · 标签装修', modes: ['provider'] },
  { key: 'verification', icon: <BadgeCheck    size={18} />, label: '联系方式与资质验证', sub: '社交媒体、手机验证、商户认证', modes: ['provider'] },
  { key: 'transactions',      icon: <ClipboardList  size={18} />, label: '我的交易',     sub: '需求 · 接单 · 成交',       modes: ['client', 'provider'] },
  { key: 'account',      icon: <ShieldCheck   size={18} />, label: '帐号和安全',        sub: '个人信息 · 密码 · 通知设置', modes: ['client', 'provider'] },
  { key: 'messages',     icon: <MessageSquare  size={18} />, label: '我的消息',     sub: '与商家的对话记录', modes: ['client', 'provider'] },
  { key: 'membership',   icon: <Crown         size={18} />, label: '会员等级',           sub: '查看商家会员权益', modes: ['client', 'provider'] },
  { key: 'my_events',      icon: <Calendar      size={18} />, label: '我报名的活动', sub: '已报名的同城活动', modes: ['client', 'provider'] },
  { key: 'referral',       icon: <Gift          size={18} />, label: '邀请好友',    sub: '我的分享码 · 已邀请人数', modes: ['client', 'provider'] },
]

// ── Feature flag ──────────────────────────────────────────────────────────────
// Mode switching (用户模式 / 服务商模式 + green/blue background) is hidden for
// now — the boss decided users navigate freely via the home tabs + map, so a
// separate Profile mode toggle isn't needed. All the code is kept intact;
// flip this to true to bring the feature back.
const SHOW_MODE_TOGGLE = true

export default function Profile() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user     = useAuthStore((s) => s.user)
  const leadCount = useLeadAlertsStore((s) => s.count)

  const VALID_SECTIONS = MENU.map((m) => m.key)

  const [section, setSection] = useState<Section | null>(() => {
    const param = searchParams.get('section') as Section | null
    if (param && VALID_SECTIONS.includes(param)) return param
    return typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'homepage' : null
  })

  const [name,            setName]            = useState('')
  const [phone,           setPhone]           = useState('')
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null)
  const [memberLevel,     setMemberLevel]     = useState<MemberLevel>('L1')
  const [memberExpiresAt, setMemberExpiresAt] = useState<string | null>(null)
  const [uploading,       setUploading]       = useState(false)
  const [confirmLogout,   setConfirmLogout]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [browse, setBrowse] = useState<BrowseEntry[]>([])
  const [hasServices, setHasServices] = useState(
    () => localStorage.getItem('tcs_has_services') === 'true',
  )
  const [verify, setVerify] = useState({ email: false, phone: false, idOrBiz: false })
  const [creditPenalty, setCreditPenalty] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [flipping, setFlipping] = useState(false)   // 身份翻转 / 上下线进行中
  const [mode, setMode] = useState<'client' | 'provider'>(() => {
    const saved = localStorage.getItem('tcs_profile_mode')
    if (saved === 'provider' || saved === 'client') return saved
    // First visit: fall back to cached provider detection to avoid flicker
    return localStorage.getItem('tcs_has_services') === 'true' ? 'provider' : 'client'
  })

  // React to URL param changes while Profile is already mounted
  // (e.g. clicking the floating Messages button when already on /profile)
  useEffect(() => {
    const param = searchParams.get('section') as Section | null
    // No (or invalid) section param → reset to the default view instead of
    // returning early, otherwise tapping 我的 while on 消息 leaves the old
    // section stuck on screen ("进不去").
    if (!param || !VALID_SECTIONS.includes(param)) {
      setSection(typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'homepage' : null)
      return
    }
    // Auto-switch mode if section belongs to the other mode
    const item = MENU.find((m) => m.key === param)
    if (item && !item.modes.includes(mode)) {
      const targetMode = item.modes[0]
      setMode(targetMode)
      localStorage.setItem('tcs_profile_mode', targetMode)
    }
    setSection(param)
  }, [searchParams, mode])

  // Opening 「我接的单」 clears the lead badge + marks those notifications read.
  useEffect(() => {
    if ((section === 'claimed_inquiries' || (section === 'transactions' && mode === 'provider')) && user) {
      void useLeadAlertsStore.getState().markSeen(user.id)
    }
  }, [section, user, mode])

  // Keep the app-wide blue「上线接单」tint locked to the current mode — including
  // the URL-driven auto-switch above, which sets mode without calling switchMode.
  useEffect(() => {
    useOnlineModeStore.getState().setOnline(mode === 'provider')
  }, [mode])

  // 服务商模式 ≡ 上线接单：翻转到「服务商」= 自动上线（显示到地图），
  // 翻回「用户」= 自动下线。上线接单不再是主页里单独的按钮。
  async function switchMode(next: 'client' | 'provider') {
    setMode(next)
    localStorage.setItem('tcs_profile_mode', next)
    // If currently viewing a section not in the new mode, clear it
    const item = MENU.find((m) => m.key === section)
    if (item && !item.modes.includes(next)) setSection(null)

    // Drive the app-wide blue「上线接单」tint immediately (optimistic).
    useOnlineModeStore.getState().setOnline(next === 'provider')

    if (!user || flipping) return
    setFlipping(true)
    try {
      if (next === 'provider') {
        // Go online. Fuzz the GPS 300–900m (like demand pins) — the online pin
        // is publicly readable, never store the raw home address.
        let lat: number | null = null
        let lng: number | null = null
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }))
          const f = offsetLocation(pos.coords.latitude, pos.coords.longitude)
          lat = f.lat; lng = f.lng
        } catch {
          toast('已上线接单，但未获取到位置，地图上暂不显示你', 'info')
        }
        await supabase.from('users').update({
          is_online: true, online_lat: lat, online_lng: lng,
          last_seen_at: new Date().toISOString(),
        }).eq('id', user.id)
        if (lat != null) toast('已上线接单 · 显示到地图', 'success')
      } else {
        await supabase.from('users').update({
          is_online: false, online_lat: null, online_lng: null,
          last_seen_at: new Date().toISOString(),
        }).eq('id', user.id)
        toast('已切换为用户模式 · 已下线', 'success')
      }
    } finally {
      setFlipping(false)
    }
  }

  // Unauthenticated: show benefits screen (no hard redirect — let the screen sell the value)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('users')
        .select('name, avatar_url, membership_level, membership_expires_at, is_email_verified, phone_verified, id_verified, business_verified, role')
        .eq('id', user.id).single(),
      supabase.rpc('get_my_contact').returns<{ name: string; phone: string; wechat: string }[]>().maybeSingle(),   // phone REVOKEd — read own via RPC
      supabase.from('public_profiles').select('credit_penalty').eq('id', user.id).single(),   // credit_penalty REVOKEd from base — read via view
    ])
      .then(([{ data }, { data: contact }, { data: pub }]) => {
        if (!data) return
        const c = contact as { phone?: string } | null
        setName(data.name ?? user.user_metadata?.name ?? '用户')
        setPhone(c?.phone ?? user.user_metadata?.phone ?? '')
        setAvatarUrl(data.avatar_url ?? null)
        const expiry = data.membership_expires_at ? new Date(data.membership_expires_at) : null
        const isActive = !!(expiry && expiry > new Date())
        setMemberLevel(isActive ? (data.membership_level as MemberLevel) ?? 'L1' : 'L1')
        setMemberExpiresAt(data.membership_expires_at ?? null)
        setVerify({
          email:   data.is_email_verified ?? false,
          phone:   data.phone_verified ?? false,
          idOrBiz: (data.id_verified ?? false) || (data.business_verified ?? false),
        })
        setCreditPenalty((pub as { credit_penalty?: number } | null)?.credit_penalty ?? 0)
        setIsAdmin((data as { role?: string }).role === 'admin')
      })
    try { setBrowse(JSON.parse(localStorage.getItem('tcs_browse_history') ?? '[]')) } catch { /* */ }

    // Auto-detect provider role (has at least one published service)
    supabase.from('services').select('id', { head: true, count: 'exact' })
      .eq('provider_id', user.id).eq('is_available', true).limit(1)
      .then(({ count }) => {
        const isProv = (count ?? 0) > 0
        setHasServices(isProv)
        // Cache for next visit so initial render won't flicker
        localStorage.setItem('tcs_has_services', isProv ? 'true' : 'false')
        // First-time visit: default to provider if user has services
        if (!localStorage.getItem('tcs_profile_mode') && isProv) {
          setMode('provider')
        }
      })
  }, [user])

  if (!user) return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="w-full bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-gray-800">我的账号</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                        flex items-center justify-center text-white text-3xl shadow-lg">
          👤
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">登录后解锁完整功能</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
            加入华邻，一键发现大多伦多华人生活服务
          </p>
        </div>
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {[
            { icon: '🔍', label: '智能AI帮你找服务', sub: '描述需求，自动匹配服务商' },
            { icon: '💬', label: '一键发起询价', sub: '5分钟内获得多家报价' },
            { icon: '❤️', label: '收藏喜欢的服务', sub: '随时查看，对比不迷路' },
            { icon: '🎁', label: '邀请好友得奖励', sub: '专属邀请码，双方都受益' },
          ].map(({ icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3.5 px-5 py-4 text-left">
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => navigate('/login', { state: { from: '/profile' } })}
            className="w-full bg-primary-600 hover:bg-primary-700 active:scale-95 text-white
                       font-semibold py-3.5 rounded-2xl text-sm transition-all shadow-sm"
          >
            登录 / 注册
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full text-gray-500 text-sm py-2"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  )

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const imgMod = await moderateImage(compressed)   // 黄暴血腥；fail-open
      if (!imgMod.pass) {
        toast(`头像未通过审核：${imgMod.reason ?? '含违规内容'}`, 'error')
        setUploading(false)
        if (fileRef.current) fileRef.current.value = ''
        return
      }
      const path = `${user!.id}/avatar.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user!.id)
      setAvatarUrl(publicUrl + '?t=' + Date.now())
    } catch (err) {
      toast('头像上传失败：' + (err instanceof Error ? err.message : '请先创建 avatars 存储桶'), 'error')
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
              ? <img loading="lazy" src={avatarUrl} alt="avatar" className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
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
          <div className="mt-1">
            <CreditStars
              input={{
                emailVerified:        verify.email,
                phoneVerified:        verify.phone,
                idOrBusinessVerified: verify.idOrBiz,
                creditPenalty,
              }}
            />
          </div>
        </div>
      </div>

      {/* 一键身份翻转 — 双栖用户在「用户/服务商」视角间切换（说明书 §5.1）*/}
      {SHOW_MODE_TOGGLE && (
        <button
          onClick={() => switchMode(mode === 'client' ? 'provider' : 'client')}
          disabled={flipping}
          className={`w-full rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm border transition-colors active:scale-[0.99] disabled:opacity-70
            ${mode === 'client'
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${mode === 'client' ? 'bg-green-100' : 'bg-blue-100'}`}>
              {mode === 'client'
                ? <UserIcon size={20} className="text-green-600" />
                : <Store size={20} className="text-blue-600" />}
            </div>
            <div className="text-left min-w-0">
              <p className={`text-lg font-bold truncate ${mode === 'client' ? 'text-green-700' : 'text-blue-700'}`}>
                {mode === 'client' ? '下线休息' : '上线接单'}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {flipping ? '定位中…' : mode === 'client' ? '客户模式（下线）' : '服务商模式（上线）'}
              </p>
            </div>
          </div>
          <span className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0 shadow-sm relative
            ${mode === 'client' ? 'bg-blue-600' : 'bg-green-600'}`}>
            <RefreshCw size={14} className={flipping ? 'animate-spin' : ''} /> {flipping ? '处理中' : '一键翻转'}
            {mode === 'client' && !hasServices && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-400 rounded-full border-2 border-white" />
            )}
          </span>
        </button>
      )}

      {/* Menu items */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
        {(SHOW_MODE_TOGGLE ? MENU.filter(item => item.modes.includes(mode)) : MENU).map(item => {
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
                <p className={`text-sm font-medium flex items-center gap-2 ${active ? 'text-primary-700' : 'text-gray-800'}`}>
                  {item.label}
                  {item.key === 'transactions' && mode === 'provider' && leadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {leadCount > 9 ? '9+' : leadCount}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
              </div>
              <ChevronRight size={16} className={active ? 'text-primary-400' : 'text-gray-300'} />
            </button>
          )
        })}
      </div>

      {/* Admin console entry — only for admins. App/PWA mode has no address bar,
          so this is the only way in on mobile. */}
      {isAdmin && (
        <button
          onClick={() => navigate('/admin')}
          className="w-full flex items-center gap-4 px-5 py-4 bg-white rounded-3xl border border-purple-200 shadow-sm hover:bg-purple-50 active:bg-purple-100 transition-colors text-left"
        >
          <span className="flex-shrink-0 text-lg">🛡️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-purple-700">管理后台</p>
            <p className="text-xs text-gray-400 mt-0.5">用户 · 认证 · 服务 · 会员 · 日志</p>
          </div>
          <ChevronRight size={16} className="text-purple-300" />
        </button>
      )}

      {/* Install as App */}
      <InstallAppButton />

      {/* Contact us — 提交建议 / 举报投诉 / 寻求合作 */}
      <ContactUsButton />

      {/* Legal links */}
      <div className="flex justify-center gap-4 text-xs text-gray-400">
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 hover:underline">服务条款</a>
        <span>·</span>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 hover:underline">隐私政策</a>
      </div>

      {/* Logout — two-step inline confirm to avoid accidental sign-out */}
      {confirmLogout ? (
        <div className="flex gap-2">
          <button onClick={() => setConfirmLogout(false)}
            className="flex-1 bg-white border border-gray-200 text-gray-500 rounded-2xl py-3.5
                       text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
            取消
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 border border-red-500
                       text-white rounded-2xl py-3.5 text-sm font-medium hover:bg-red-600
                       transition-colors shadow-sm">
            <LogOut size={16} />
            确认退出
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmLogout(true)}
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200
                     text-red-500 rounded-2xl py-3.5 text-sm font-medium hover:bg-red-50
                     transition-colors shadow-sm">
          <LogOut size={16} />
          退出登录
        </button>
      )}
    </div>
  )

  // ── Section content renderer ─────────────────────────────────────────────────
  function renderSection(key: Section | null) {
    switch (key) {
      case 'homepage':     return <HomepageSection />
      case 'account':
      case 'notifications':
        // 帐号和安全 is the settings hub: account info + password + 通知设置.
        return (
          <>
            <AccountSection user={user!} name={name} phone={phone} onNameChange={setName} onPhoneChange={setPhone} />
            <NotificationsSection />
          </>
        )
      case 'verification': return <VerificationSection user={user!} />
      case 'membership':   return <MembershipSection level={memberLevel} expiresAt={memberExpiresAt} />
      case 'services':     return <ServicesSection />
      case 'saves':        return <SavesSection />
      case 'follows':      return <FollowsSection />
      case 'stats':        return <StatsSection />
      case 'community':    return <CommunitySection />
      case 'referral':     return <ReferralSection user={user!} />
      case 'transactions':       return <TransactionsSection mode={mode} />
      // Legacy / deep-link keys land inside 我的交易 on the matching tab.
      case 'inquiries':          return <TransactionsSection mode={mode} initialTab="inquiries" />
      case 'claimed_inquiries':  return <TransactionsSection mode={mode} initialTab="claimed" />
      case 'orders':             return <TransactionsSection mode={mode} initialTab="orders" />
      case 'my_events':          return <MyEventsSection />
      case 'messages':       return <MessagesSection />
      case 'browse':       return <BrowseSection items={browse} onClear={() => { localStorage.removeItem('tcs_browse_history'); setBrowse([]) }} />
      default:             return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 bg-gray-50">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white border-b-2 border-gray-200 px-4 h-14 flex items-center gap-3 sticky top-0 z-20">
        <button
          // Context-aware back:
          //  • section opened from the account menu (setSection, URL still /profile,
          //    no ?section) → return to the menu.
          //  • section opened via URL (bottom-nav 消息 / deep link, URL has ?section)
          //    or already at the menu → browser back to wherever we came from.
          onClick={() => {
            if (section && !searchParams.get('section')) setSection(null)
            else navigate(-1)
          }}
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
