import { jsonResponse } from '../lib/http.ts'
import { askModel } from '../lib/model.ts'
import { cap } from '../lib/sanitize.ts'
import { fallbackExpandedTerms } from '../lib/searchExpansion.ts'
import { fetchServiceTitles } from '../lib/services.ts'
import type { ActionPayload } from '../lib/types.ts'

export async function handleExpandSearch(payload: ActionPayload): Promise<Response> {
  const query = cap(String(payload.query ?? ''), 100)
  if (!query) return jsonResponse({ terms: [] })

  const serviceTitles = await fetchServiceTitles()
  let aiTerms: string[] = []

  try {
    const raw = await askModel(
      `用户搜索词：${query}
平台当前服务标题样例：${serviceTitles.slice(0, 40).join(' / ')}

请输出 JSON：
{
  "terms": ["最多6个适合搜索扩展的中文短语"]
}

要求：
1. 只输出与本地生活服务匹配的短语
2. 不要重复用户原词
3. 优先输出用户真实会点进去的服务名，如"水管维修""屋顶维修"
4. 最多 6 个`
    )
    const parsed = JSON.parse(raw)
    aiTerms = Array.isArray(parsed.terms)
      ? parsed.terms.map((term: unknown) => cap(String(term), 20)).filter(Boolean)
      : []
  } catch {
    aiTerms = []
  }

  const merged = Array.from(new Set([...fallbackExpandedTerms(query), ...aiTerms])).slice(0, 6)
  return jsonResponse({ terms: merged })
}
