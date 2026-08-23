// ─── Google 登录邀请码(内测2-#4)──────────────────────────────────────────────
// OAuth 跳转拿不到 metadata,只能:跳转前把邀请码暂存,登录回来后调 RPC 补写。
// apply_referral_code 幂等(已设过/无效码/自邀 都不生效),多次调用安全。
import { supabase } from './supabase'

const KEY = 'tcs_pending_ref'

export function stashPendingReferral(code: string | null | undefined) {
  const c = (code ?? '').trim().toUpperCase()
  try { if (c) localStorage.setItem(KEY, c) } catch { /* ignore */ }
}

// 只读取暂存的邀请码(不清除)——用于注册页预填,即使链接落在首页也能带出来。
export function peekPendingReferral(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

export async function applyPendingReferral(): Promise<void> {
  let code: string | null = null
  try { code = localStorage.getItem(KEY) } catch { /* ignore */ }
  if (!code) return
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  try { await supabase.rpc('apply_referral_code', { p_code: code }) } catch { /* best-effort */ }
}
