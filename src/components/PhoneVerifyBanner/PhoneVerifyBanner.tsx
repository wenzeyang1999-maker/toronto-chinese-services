// ─── PhoneVerifyBanner ──────────────────────────────────────────────────────
// Shown at the top of post/inquiry forms: warns unverified users UP FRONT that
// they must verify their phone before publishing — so they don't fill the whole
// form only to be bounced to verification at submit (losing their input).
// The submit-time ensurePhoneVerified() gate stays as the hard backstop.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function PhoneVerifyBanner() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [needVerify, setNeedVerify] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    supabase.from('users').select('phone_verified, role').eq('id', user.id).single()
      .then(({ data }) => { if (active) setNeedVerify(!!data && data.role !== 'admin' && !data.phone_verified) })
    return () => { active = false }
  }, [user?.id])

  if (!needVerify) return null

  return (
    <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
      <AlertCircle size={17} className="text-amber-500 flex-shrink-0" />
      <p className="text-xs text-amber-700 flex-1 leading-relaxed">
        发布前需先<strong>验证手机号</strong>。建议现在验证，避免填完内容后被打断。
      </p>
      <button onClick={() => navigate('/profile?section=verification')}
        className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors">
        去验证
      </button>
    </div>
  )
}
