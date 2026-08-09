// ─── AI 统一搜索路由(内测#6) ─────────────────────────────────────────────────
// 把自然语言搜索交给 smart-search 边缘函数分类 → 跳到对应板块结果/地图。
// 失败返回 null,调用方回退普通关键词搜索,保证搜索永不被 AI 挡住。
import { supabase } from './supabase'

export interface SmartRoute {
  domain: 'service' | 'realestate' | 'secondhand' | 'jobs' | 'community'
  keyword: string
  urgent: boolean
}

export async function smartSearch(text: string): Promise<SmartRoute | null> {
  try {
    const { data, error } = await supabase.functions.invoke<SmartRoute>('smart-search', { body: { text } })
    if (error || !data || !data.domain) return null
    return data
  } catch {
    return null
  }
}

/** domain + keyword → 站内路由 URL */
export function smartRouteToUrl(r: SmartRoute): string {
  const kw = encodeURIComponent((r.keyword || '').trim())
  switch (r.domain) {
    case 'realestate': return `/realestate?keyword=${kw}`
    case 'secondhand': return `/secondhand?keyword=${kw}`
    case 'jobs':       return `/jobs?keyword=${kw}`
    case 'community':  return `/search?q=${kw}&global=1`
    case 'service':
    default:           return `/search?q=${kw}`
  }
}
