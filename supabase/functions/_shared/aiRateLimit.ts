import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

// Client IP from the proxy headers (Supabase sets x-forwarded-for).
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('cf-connecting-ip') ?? 'unknown'
}

// Append-only per-IP rate limit against public.ai_call_log. Returns true if the
// call is allowed (and records it), false if the IP is over the limit in the
// window. Fails OPEN on any DB error so a logging hiccup never blocks real users.
export async function allowAiCall(
  req: Request,
  fn: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const url            = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceRoleKey) return true
    const admin = createClient(url, serviceRoleKey)
    const ip = clientIp(req)
    const windowStart = new Date(Date.now() - windowMs).toISOString()

    await admin.from('ai_call_log').delete().lt('created_at', windowStart)

    const { count } = await admin
      .from('ai_call_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('fn', fn)
      .gte('created_at', windowStart)

    if ((count ?? 0) >= max) return false

    await admin.from('ai_call_log').insert({ ip, fn })
    return true
  } catch {
    return true
  }
}
