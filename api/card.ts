// ─── 商家名片分享卡(服务端 OG)────────────────────────────────────────────────
// 分享链接 /p/:id → 重写到 /api/card?id=:id。爬虫(微信/FB/iMessage)抓到本页,
// 读取 OG 标签渲染富卡片(SPA 前端设的 meta 爬虫看不到,必须服务端出)。
// 真人打开 → meta refresh 跳到 /provider/:id 完整名片页(CSP 禁内联脚本,故用 meta)。
import type { VercelRequest, VercelResponse } from '@vercel/node'

const SITE = 'https://hualinlife.com'
const SUPA = process.env.VITE_SUPABASE_URL || 'https://suvjhtiglecjgcnzdgfo.supabase.co'
const ANON = process.env.VITE_SUPABASE_ANON_KEY || ''

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id || '')
  const profileUrl = `${SITE}/provider/${encodeURIComponent(id)}`

  let card: { name?: string; title?: string; area?: string; avatar_url?: string } | null = null
  try {
    if (id && ANON) {
      const r = await fetch(`${SUPA}/rest/v1/rpc/provider_card`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_id: id }),
      })
      if (r.ok) card = await r.json()
    }
  } catch { /* fall back to generic card */ }

  const name  = esc(card?.name || '华邻商家')
  const title = esc(card?.title || '华人本地服务')
  const area  = esc(card?.area || '多伦多及 GTA')
  const img   = esc(card?.avatar_url || `${SITE}/icon-512.png`)
  const ogTitle = `${name}｜${title}`
  const ogDesc  = `服务地区：${area} · 华邻 HuaLin`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
  res.status(200).send(`<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ogTitle} · 华邻</title>
<meta name="description" content="${ogDesc}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="华邻 HuaLin">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${profileUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDesc}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${profileUrl}">
<meta http-equiv="refresh" content="0;url=${profileUrl}">
<style>
body{font-family:system-ui,-apple-system,"PingFang SC",sans-serif;background:#f7f8fa;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
.c{background:#fff;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:28px 24px;max-width:340px;width:100%;text-align:center}
.c img{width:88px;height:88px;border-radius:50%;object-fit:cover;background:#eef2ff}
.n{font-size:20px;font-weight:800;margin:14px 0 4px;color:#111}
.t{color:#2563eb;font-weight:600}
.a{color:#6b7280;font-size:14px;margin-top:6px}
.b{display:inline-block;margin-top:18px;background:#2563eb;color:#fff;text-decoration:none;padding:11px 22px;border-radius:12px;font-weight:600}
</style></head>
<body>
  <div class="c">
    <img src="${img}" alt="${name}" onerror="this.style.display='none'">
    <div class="n">${name}</div>
    <div class="t">${title}</div>
    <div class="a">服务地区：${area}</div>
    <a class="b" href="${profileUrl}">进入华邻查看名片 →</a>
  </div>
</body></html>`)
}
