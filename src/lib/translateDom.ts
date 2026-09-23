// ─── 运行时机翻(中文→英/法)──────────────────────────────────────────────────
// 复用与繁体转换相同的 DOM 遍历思路,但翻译是异步的:收集页面中文 → 批量调 translate
// 边缘函数(缓存优先)→ 拿到译文后套用 → MutationObserver 追后续内容(去抖批处理)。
// 命中缓存的字符串瞬时返回,只有全新文案才走一次机翻,之后全站共享。
import { supabase } from './supabase'

const CJK = /[一-鿿]/
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT'])
const ATTRS = ['placeholder', 'title', 'alt', 'aria-label']
const cache = new Map<string, string>()   // 源中文 → 译文(内存)
let lang: 'en' | 'fr' = 'en'

function skip(el: Element | null): boolean {
  return !el || SKIP.has(el.tagName) || (el as HTMLElement).isContentEditable
}

// 收集待翻译的中文(未缓存的)
function collect(root: Node, out: Set<string>) {
  if (root.nodeType === Node.TEXT_NODE) {
    const s = (root.nodeValue || '').trim()
    if (s && CJK.test(s) && !cache.has(s) && !skip(root.parentElement)) out.add(s)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  if (skip(el)) return
  for (const a of ATTRS) { const v = el.getAttribute(a)?.trim(); if (v && CJK.test(v) && !cache.has(v)) out.add(v) }
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const s = (n.nodeValue || '').trim()
      return s && CJK.test(s) && !cache.has(s) && !skip(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  let n: Node | null; while ((n = tw.nextNode())) { const s = (n.nodeValue || '').trim(); if (s) out.add(s) }
  el.querySelectorAll('[placeholder],[title],[alt],[aria-label]').forEach((e) => {
    for (const a of ATTRS) { const v = e.getAttribute(a)?.trim(); if (v && CJK.test(v) && !cache.has(v)) out.add(v) }
  })
}

// 用缓存译文套用到 DOM(保留首尾空白)
function apply(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { applyText(root as Text); return }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  if (skip(el)) return
  applyAttrs(el)
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (!skip(n.parentElement) && CJK.test(n.nodeValue || '')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  })
  let n: Node | null; while ((n = tw.nextNode())) applyText(n as Text)
  el.querySelectorAll('[placeholder],[title],[alt],[aria-label]').forEach(applyAttrs)
}
function applyText(node: Text) {
  const raw = node.nodeValue || ''
  const core = raw.trim()
  const dst = cache.get(core)
  if (dst && dst !== core) node.nodeValue = raw.replace(core, dst)
}
function applyAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a); if (!v) continue
    const dst = cache.get(v.trim())
    if (dst && dst !== v.trim()) el.setAttribute(a, v.replace(v.trim(), dst))
  }
}

async function fetchTranslations(texts: string[]) {
  for (let i = 0; i < texts.length; i += 80) {
    const chunk = texts.slice(i, i + 80)
    try {
      const { data } = await supabase.functions.invoke<{ map: Record<string, string> }>('translate', { body: { lang, texts: chunk } })
      if (data?.map) for (const [k, v] of Object.entries(data.map)) cache.set(k, v)
    } catch { /* 失败保持中文 */ }
  }
}

const pending = new Set<string>()
let timer: number | undefined
function schedule(strings: Set<string>) {
  strings.forEach((s) => pending.add(s))
  window.clearTimeout(timer)
  timer = window.setTimeout(async () => {
    const batch = Array.from(pending); pending.clear()
    if (batch.length) await fetchTranslations(batch)
    apply(document.body)
  }, 250)
}

let started = false
export async function startTranslate(l: 'en' | 'fr') {
  if (started) return
  started = true
  lang = l
  document.documentElement.lang = l
  const s = new Set<string>(); collect(document.body, s); schedule(s)
  const obs = new MutationObserver((muts) => {
    const found = new Set<string>()
    for (const m of muts) {
      if (m.type === 'characterData') collect(m.target, found)
      m.addedNodes.forEach((nd) => collect(nd, found))
      if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
        for (const a of ATTRS) { const v = (m.target as Element).getAttribute(a)?.trim(); if (v && CJK.test(v) && !cache.has(v)) found.add(v) }
      }
    }
    if (found.size) schedule(found)
    else apply(document.body)   // 新节点可能是已缓存文案 → 直接套用
  })
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
}
