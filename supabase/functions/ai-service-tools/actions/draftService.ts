import { CATEGORY_LABELS } from '../lib/constants.ts'
import { jsonResponse } from '../lib/http.ts'
import { askModel } from '../lib/model.ts'
import { cap } from '../lib/sanitize.ts'
import type { ActionPayload } from '../lib/types.ts'

export async function handleDraftService(payload: ActionPayload): Promise<Response> {
  const categoryId = cap(String(payload.categoryId ?? 'other'), 30)
  const categoryLabel = CATEGORY_LABELS[categoryId] ?? '其他服务'
  const title = cap(String(payload.title ?? ''), 60)
  const keywords = cap(String(payload.keywords ?? ''), 200)
  const priceType = cap(String(payload.priceType ?? 'hourly'), 20)
  const serviceAreas = Array.isArray(payload.serviceAreas)
    ? payload.serviceAreas.map((item) => cap(String(item), 30)).slice(0, 5)
    : []

  const raw = await askModel(
    `你要帮多伦多华人服务平台的服务商生成发布文案。
服务分类：${categoryLabel}
当前标题：${title || '未填写'}
关键词/补充说明：${keywords || '未填写'}
服务区域：${serviceAreas.join('、') || '多伦多'}
价格类型：${priceType}

请输出 JSON：
{
  "title": "20字内标题",
  "description": "120到220字，口语自然，强调服务内容、经验、适合人群、响应速度，不要夸张承诺",
  "tags": ["最多6个短标签"]
}

要求：
1. 必须贴近本地华人服务语境
2. 标题不要太营销，不要出现联系电话
3. 描述要能直接用于发布页
4. tags 用于搜索联想，尽量具体`
  )

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Model returned invalid JSON')
  }

  return jsonResponse({
    title: cap(String(parsed.title ?? ''), 60),
    description: cap(String(parsed.description ?? ''), 500),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((tag) => cap(String(tag), 20)).filter(Boolean).slice(0, 6)
      : [],
  })
}
