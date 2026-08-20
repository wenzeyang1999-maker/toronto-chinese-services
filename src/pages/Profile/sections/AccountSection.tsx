import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Phone, Lock, User, Pencil, Check, X, ChevronRight, AlignLeft, Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from '../../../lib/toast'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const DELETE_CONFIRM_PHRASE = '删除我的账号'

interface Props {
  user:   SupabaseUser
  name:   string
  phone:  string
  onNameChange:  (v: string) => void
  onPhoneChange: (v: string) => void
}

export default function AccountSection({ user, name, phone, onNameChange, onPhoneChange }: Props) {
  const [editingName,  setEditingName]  = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [nameInput,    setNameInput]    = useState('')
  const [phoneInput,   setPhoneInput]   = useState('')
  const [saving,       setSaving]       = useState(false)

  const [bio,        setBio]        = useState('')
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput,   setBioInput]   = useState('')

  useEffect(() => {
    supabase.from('users').select('bio').eq('id', user.id).single()
      .then(({ data }) => { if (data?.bio) setBio(data.bio) })
  }, [user.id])

  async function saveBio() {
    setSaving(true)
    const { error } = await supabase.from('users').update({ bio: bioInput.trim() }).eq('id', user.id)
    setSaving(false)
    if (error) { toast('保存失败：' + error.message, 'error'); return }
    setBio(bioInput.trim())
    setEditingBio(false)
  }

  const [showPwd,    setShowPwd]    = useState(false)
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg,     setPwdMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [pwdBusy,    setPwdBusy]    = useState(false)

  async function saveName() {
    if (!nameInput.trim()) return
    setSaving(true)
    const { error } = await supabase.from('users').update({ name: nameInput.trim() }).eq('id', user.id)
    setSaving(false)
    if (error) { toast('保存失败：' + error.message, 'error'); return }
    onNameChange(nameInput.trim())
    setEditingName(false)
  }

  async function savePhone() {
    setSaving(true)
    const { error } = await supabase.from('users').update({ phone: phoneInput.trim() }).eq('id', user.id)
    setSaving(false)
    if (error) { toast('保存失败：' + error.message, 'error'); return }
    onPhoneChange(phoneInput.trim())
    setEditingPhone(false)
  }

  async function changePassword() {
    if (newPwd.length < 8) { setPwdMsg({ ok: false, text: '密码至少 8 位' }); return }
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: '两次密码不一致' }); return }
    setPwdBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    if (error) {
      setPwdMsg({ ok: false, text: error.message })
    } else {
      setPwdMsg({ ok: true, text: '密码修改成功' })
      setNewPwd(''); setConfirmPwd('')
      setTimeout(() => { setShowPwd(false); setPwdMsg(null) }, 1500)
    }
    setPwdBusy(false)
  }

  // ── 注销账号(立即硬删除,不可恢复)────────────────────────────────────────
  const [delOpen,    setDelOpen]    = useState(false)
  const [delConfirm, setDelConfirm] = useState('')
  const [delBusy,    setDelBusy]    = useState(false)

  async function deleteAccount() {
    if (delConfirm.trim() !== DELETE_CONFIRM_PHRASE) return
    setDelBusy(true)
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('delete-account', { body: {} })
    if (error || !data?.ok) {
      setDelBusy(false)
      toast('注销失败：' + (data?.error ?? error?.message ?? '请稍后再试'), 'error')
      return
    }
    // 账号已删,退出登录并回首页(整页刷新以清空所有内存状态)
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <motion.div
      key="account"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
      className="flex-1 px-4 py-6 max-w-md lg:max-w-none mx-auto w-full space-y-4"
    >
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {/* Name */}
        <div className="flex items-center gap-3 px-5 py-4">
          <User size={16} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-500 w-14 flex-shrink-0">昵称</span>
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                className="flex-1 text-sm border-b border-primary-400 outline-none bg-transparent" />
              <button onClick={saveName} disabled={saving} className="text-primary-600"><Check size={15} /></button>
              <button onClick={() => setEditingName(false)} className="text-gray-400"><X size={15} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-800 flex-1">{name}</span>
              <button onClick={() => { setNameInput(name); setEditingName(true) }} className="text-gray-400 hover:text-primary-600"><Pencil size={13} /></button>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="flex items-center gap-3 px-5 py-4">
          <Mail size={16} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-500 w-14 flex-shrink-0">邮箱</span>
          <span className="text-sm text-gray-800 flex-1 truncate">{user.email}</span>
        </div>

        {/* Phone */}
        <div className="flex items-center gap-3 px-5 py-4">
          <Phone size={16} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-500 w-14 flex-shrink-0">手机号</span>
          {editingPhone ? (
            <div className="flex items-center gap-2 flex-1">
              <input autoFocus value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && savePhone()} placeholder="请输入手机号"
                className="flex-1 text-sm border-b border-primary-400 outline-none bg-transparent" />
              <button onClick={savePhone} disabled={saving} className="text-primary-600"><Check size={15} /></button>
              <button onClick={() => setEditingPhone(false)} className="text-gray-400"><X size={15} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-800 flex-1">{phone || '未填写'}</span>
              <button onClick={() => { setPhoneInput(phone); setEditingPhone(true) }} className="text-gray-400 hover:text-primary-600"><Pencil size={13} /></button>
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="flex items-start gap-3 px-5 py-4">
          <AlignLeft size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-gray-500 w-14 flex-shrink-0 mt-0.5">简介</span>
          {editingBio ? (
            <div className="flex-1">
              <textarea autoFocus rows={3} value={bioInput} onChange={e => setBioInput(e.target.value)}
                placeholder="介绍一下自己…"
                className="w-full text-sm border border-primary-300 rounded-xl px-3 py-2 outline-none resize-none focus:ring-2 focus:ring-primary-300" />
              <div className="flex gap-2 mt-1.5">
                <button onClick={saveBio} disabled={saving} className="text-xs text-white bg-primary-600 px-3 py-1 rounded-lg">保存</button>
                <button onClick={() => setEditingBio(false)} className="text-xs text-gray-400">取消</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 flex-1">
              <span className="text-sm text-gray-800 flex-1 whitespace-pre-wrap leading-relaxed">{bio || '未填写'}</span>
              <button onClick={() => { setBioInput(bio); setEditingBio(true) }} className="text-gray-400 hover:text-primary-600 flex-shrink-0"><Pencil size={13} /></button>
            </div>
          )}
        </div>

        {/* Password */}
        <div>
          <button onClick={() => { setShowPwd(v => !v); setPwdMsg(null) }}
            className="w-full flex items-center gap-3 px-5 py-4">
            <Lock size={16} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-500 w-14 flex-shrink-0">密码</span>
            <span className="text-sm text-gray-800 flex-1">修改密码</span>
            <ChevronRight size={16} className={`text-gray-400 transition-transform ${showPwd ? 'rotate-90' : ''}`} />
          </button>
          {showPwd && (
            <div className="px-5 pb-5 space-y-3 border-t border-gray-100">
              <input type="password" placeholder="新密码（至少 8 位）" value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-300 mt-3" />
              <input type="password" placeholder="确认新密码" value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && changePassword()}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-300" />
              {pwdMsg && <p className={`text-xs ${pwdMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{pwdMsg.text}</p>}
              <button onClick={changePassword} disabled={pwdBusy}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors disabled:opacity-60">
                {pwdBusy ? '保存中...' : '确认修改'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 危险区:注销账号 */}
      <div className="bg-white rounded-3xl border border-red-100 shadow-sm">
        <button onClick={() => { setDelConfirm(''); setDelOpen(true) }}
          className="w-full flex items-center gap-3 px-5 py-4 text-red-500 hover:bg-red-50/60 rounded-3xl transition-colors">
          <Trash2 size={16} className="flex-shrink-0" />
          <span className="text-sm font-medium flex-1 text-left">注销账号</span>
          <ChevronRight size={16} className="text-red-300" />
        </button>
      </div>

      {delOpen && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center px-6"
          onClick={() => !delBusy && setDelOpen(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">永久注销账号</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                此操作<b className="text-red-500">不可恢复</b>。你的资料、发布、评价、消息、订单等所有数据将被立即删除。
              </p>
            </div>
            <label className="block text-xs text-gray-500 mb-1.5">
              请输入 <b className="text-gray-800">{DELETE_CONFIRM_PHRASE}</b> 以确认
            </label>
            <input autoFocus value={delConfirm} onChange={e => setDelConfirm(e.target.value)}
              placeholder={DELETE_CONFIRM_PHRASE}
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-red-300 mb-4" />
            <div className="flex flex-col gap-2">
              <button onClick={deleteAccount} disabled={delBusy || delConfirm.trim() !== DELETE_CONFIRM_PHRASE}
                className="w-full py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {delBusy ? '正在注销…' : '永久注销'}
              </button>
              <button onClick={() => setDelOpen(false)} disabled={delBusy}
                className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
