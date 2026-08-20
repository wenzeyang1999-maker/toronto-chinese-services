// ── 自助注销账号(立即硬删除)────────────────────────────────────────────────
// POST(带用户 JWT)→ 永久删除调用者本人的账号及其全部数据,不可恢复。
// 合规:满足 Apple App Store 5.1.1(v)「app 内可发起删除」+ PIPEDA/GDPR 被遗忘权,
// 兑现 服务条款/隐私政策 的注销承诺。
//
// 删除顺序(public.users 对 auth.users 无外键,需分别删;且有一个 NO ACTION 外键需先解开):
//   1) inquiries.assigned_provider_id = NULL where = uid   (唯一 NO ACTION 外键,不解会阻断删除)
//   2) DELETE public.users where id = uid                  (其余 40+ 子表全是 ON DELETE CASCADE,连带清除)
//   3) auth.admin.deleteUser(uid)                           (删除登录身份)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const ALLOWED_ORIGINS = new Set([
  'https://toronto-chinese-services.vercel.app',
  'https://hualinlife.com',
  'https://www.hualinlife.com',
  'http://localhost:5173',
  'http://localhost:4173',
])

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://toronto-chinese-services.vercel.app'
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors   = corsHeaders(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const url            = Deno.env.get('SUPABASE_URL')
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceRoleKey) return json({ error: 'Server misconfigured' }, 500)

    // 1) 用调用者的 JWT 确认身份 —— 只能删自己,uid 从 token 取,不信任 body。
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: userData, error: authErr } = await authClient.auth.getUser()
    if (authErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
    const uid = userData.user.id

    // 2) service_role 执行删除
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

    // 2a) 解开唯一的 NO ACTION 外键(否则 DELETE users 会因被 inquiries 引用而失败)
    const { error: inqErr } = await admin
      .from('inquiries').update({ assigned_provider_id: null }).eq('assigned_provider_id', uid)
    if (inqErr) return json({ error: `解绑询价失败：${inqErr.message}` }, 500)

    // 2b) 删除 public.users —— 其余子表 ON DELETE CASCADE 连带清除(帖子/评论/消息/订单/评价…)
    const { error: rowErr } = await admin.from('users').delete().eq('id', uid)
    if (rowErr) return json({ error: `删除用户数据失败：${rowErr.message}` }, 500)

    // 2c) 删除登录身份(auth.users)
    const { error: authDelErr } = await admin.auth.admin.deleteUser(uid)
    if (authDelErr) return json({ error: `删除登录身份失败：${authDelErr.message}` }, 500)

    return json({ ok: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
