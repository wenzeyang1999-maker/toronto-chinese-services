import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Phone, Lock, User, Pencil, Check, X, ChevronRight } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

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

  const [showPwd,    setShowPwd]    = useState(false)
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg,     setPwdMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [pwdBusy,    setPwdBusy]    = useState(false)

  async function saveName() {
    if (!nameInput.trim()) return
    setSaving(true)
    await supabase.from('users').update({ name: nameInput.trim() }).eq('id', user.id)
    onNameChange(nameInput.trim())
    setEditingName(false)
    setSaving(false)
  }

  async function savePhone() {
    setSaving(true)
    await supabase.from('users').update({ phone: phoneInput.trim() }).eq('id', user.id)
    onPhoneChange(phoneInput.trim())
    setEditingPhone(false)
    setSaving(false)
  }

  async function changePassword() {
    if (newPwd.length < 6) { setPwdMsg({ ok: false, text: '密码至少 6 位' }); return }
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
              <input type="password" placeholder="新密码（至少 6 位）" value={newPwd}
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
    </motion.div>
  )
}
