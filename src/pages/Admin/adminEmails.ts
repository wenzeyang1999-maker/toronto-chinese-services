import { supabase } from '../../lib/supabase'

// Email is no longer readable from public.users by clients (revoked for privacy;
// admins fetch it through the is_admin()-gated admin_get_user_emails RPC). Given
// a set of user ids, return an id→email map (empty for non-admins).
export async function fetchEmails(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))] as string[]
  if (!uniq.length) return new Map()
  // admin_get_user_emails isn't in the generated types yet — call untyped.
  const { data } = await (supabase.rpc as any)('admin_get_user_emails', { p_ids: uniq })
  const rows = (data ?? []) as { id: string; email: string }[]
  return new Map(rows.map(e => [e.id, e.email]))
}

// Merge emails into rows keyed by their own `id`.
export async function attachEmails<T extends { id: string }>(
  rows: T[],
): Promise<(T & { email: string })[]> {
  const map = await fetchEmails(rows.map(r => r.id))
  return rows.map(r => ({ ...r, email: map.get(r.id) ?? '' }))
}
