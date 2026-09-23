// ─── 简→繁 运行时转换 ─────────────────────────────────────────────────────────
// 选「繁體」时把整站可见中文(界面 + 用户内容)转成台湾繁体(词级,OpenCC twp)。
// 不改任何硬编码文案:遍历文本节点 + 关键属性,并用 MutationObserver 追后来渲染的内容。
// opencc-js 动态 import —— 只有选繁体才下载词库,简体(默认)用户零负担。
import * as OpenCC from 'opencc-js'

let convert: ((s: string) => string) | null = null
const done = new WeakSet<Text>()
const CJK = /[一-鿿]/
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT'])
const ATTRS = ['placeholder', 'title', 'alt', 'aria-label']

function skip(el: Element | null): boolean {
  return !el || SKIP_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable
}

function convText(node: Text) {
  if (done.has(node)) return
  const v = node.nodeValue
  if (v && CJK.test(v) && !skip(node.parentElement)) {
    const t = convert!(v)
    if (t !== v) node.nodeValue = t
  }
  done.add(node)
}

function convAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (v && CJK.test(v)) { const t = convert!(v); if (t !== v) el.setAttribute(a, t) }
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { convText(root as Text); return }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  if (skip(el)) return
  convAttrs(el)
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      !skip(n.parentElement) && CJK.test(n.nodeValue || '')
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  })
  let n: Node | null
  while ((n = tw.nextNode())) convText(n as Text)
  el.querySelectorAll('[placeholder],[title],[alt],[aria-label]').forEach(convAttrs)
}

let started = false
export async function startTraditionalize() {
  if (started) return
  started = true
  const conv = OpenCC.Converter({ from: 'cn', to: 'twp' })   // 简体 → 台湾繁体(含词汇转换)
  convert = conv
  document.documentElement.lang = 'zh-Hant'
  walk(document.body)
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
        done.delete(m.target as Text); convText(m.target as Text)
      }
      m.addedNodes.forEach(walk)
      if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) convAttrs(m.target as Element)
    }
  })
  obs.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ATTRS,
  })
}
