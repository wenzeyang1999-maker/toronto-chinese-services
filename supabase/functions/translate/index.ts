// ─── 翻译(中文→英/法,缓存优先)──────────────────────────────────────────────
// POST { lang:'en'|'fr', texts:string[] } → { map: { [src]: dst } }
// 先查 translations 缓存,未命中的批量走 Groq(gpt-oss-120b)翻译并写回缓存。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { reportError } from '../_shared/reportError.ts'

const ALLOWED = new Set([
  'https://toronto-chinese-services.vercel.app', 'https://hualinlife.com',
  'https://www.hualinlife.com', 'http://localhost:5173', 'http://localhost:4173',
])
function cors(origin: string | null) {
  const allow = origin && ALLOWED.has(origin) ? origin : 'https://hualinlife.com'
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
}
// 稳定哈希(cyrb53)
function hash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677) }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
const LANG_NAME: Record<string, string> = { en: 'English', fr: 'French (Français)' }

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const ch = cors(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: ch })
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...ch, 'Content-Type': 'application/json' } })

  try {
    const { lang, texts } = await req.json().catch(() => ({})) as { lang?: string; texts?: string[] }
    if (!lang || !LANG_NAME[lang] || !Array.isArray(texts)) return json({ map: {} })

    // 去重 + 限长(防滥用):最多 100 条、每条 ≤ 400 字
    const uniq = Array.from(new Set(texts.filter((t) => typeof t === 'string' && t.trim() && t.length <= 400))).slice(0, 100)
    if (uniq.length === 0) return json({ map: {} })

    const url = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, key, { auth: { persistSession: false } })

    const rows = uniq.map((s) => ({ src: s, h: hash(lang + '' + s) }))
    const map: Record<string, string> = {}

    // 1) 查缓存
    const { data: cached } = await admin.from('translations').select('src_hash, src, dst').eq('lang', lang).in('src_hash', rows.map((r) => r.h))
    const hit = new Set<string>()
    for (const c of (cached ?? [])) { map[(c as { src: string }).src] = (c as { dst: string }).dst; hit.add((c as { src_hash: string }).src_hash) }

    // 2) 未命中 → Groq 批量翻译
    const misses = rows.filter((r) => !hit.has(r.h))
    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (misses.length && apiKey) {
      for (let i = 0; i < misses.length; i += 40) {
        const batch = misses.slice(i, i + 40)
        const sys = `You are a professional UI localizer for "华邻/HuaLin", a Chinese-overseas local-services app in Toronto. Translate each Chinese UI string to ${LANG_NAME[lang]}. Rules: natural & concise for UI; keep brand 华邻 as "HuaLin"; keep numbers/emails/URLs/emoji; if a string has no Chinese, return it unchanged. Return ONLY JSON: {"items":[...]} with translations in the SAME order and SAME count.`
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', signal: AbortSignal.timeout(30_000),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b', temperature: 0, response_format: { type: 'json_object' },
              messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(batch.map((b) => b.src)) }],
            }),
          })
          if (!res.ok) { await reportError('translate', `groq_${res.status}`, (await res.text().catch(() => '')).slice(0, 300)); continue }
          const data = await res.json()
          const items = JSON.parse(data.choices?.[0]?.message?.content ?? '{}').items
          if (!Array.isArray(items) || items.length !== batch.length) continue
          const toInsert = batch.map((b, k) => ({ lang, src_hash: b.h, src: b.src, dst: String(items[k] ?? b.src) }))
          for (const r of toInsert) map[r.src] = r.dst
          await admin.from('translations').upsert(toInsert, { onConflict: 'lang,src_hash' })
        } catch (e) { await reportError('translate', 'exception', e instanceof Error ? e.message : String(e)) }
      }
    }
    return json({ map })
  } catch (e) {
    return json({ map: {}, error: e instanceof Error ? e.message : String(e) }, 200)
  }
})
