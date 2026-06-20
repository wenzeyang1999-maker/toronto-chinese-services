// ─── Phone verification gate ─────────────────────────────────────────────────
// Anti-spam: posting content and sending inquiries require a verified phone.
// The DB enforces this (require_phone_verified trigger); this client-side check
// gives a friendly prompt + redirect instead of a raw insert error.
//
// Usage (at the top of a submit handler):
//   if (!(await ensurePhoneVerified(navigate))) return
import { supabase } from './supabase'
import { toast } from './toast'

export async function ensurePhoneVerified(
  navigate: (to: string) => void,
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    navigate('/login')
    return false
  }

  const { data } = await supabase
    .from('users')
    .select('phone_verified, role')
    .eq('id', user.id)
    .single()

  if (data?.role === 'admin' || data?.phone_verified) return true

  toast('请先验证手机号后再发布', 'error')
  navigate('/profile?section=verification')
  return false
}
