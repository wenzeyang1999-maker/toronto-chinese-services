// ─── Greater Toronto Area cities ──────────────────────────────────────────────
// Short list for "where do you live" single-select pickers (e.g. PostRequest).
// PostService keeps its own more granular service-coverage list inline because
// it covers all of Ontario, not just user residence locations.

export const TORONTO_AREAS = [
  'Downtown Toronto 多伦多市中心',
  'North York 北约克',
  'Scarborough 士嘉堡',
  'Etobicoke 怡陶碧谷',
  'Markham 万锦',
  'Richmond Hill 列治文山',
  'Vaughan 旺市',
  'Mississauga 密西沙加',
  'Brampton 宾顿',
  'Oakville 奥克维尔',
  'Ajax 阿积士',
  'Whitby 惠特比',
  'Newmarket 新市',
  'Aurora 奥罗拉',
  'Stouffville 士多福维尔',
] as const

// ─── GTA filter chips ─────────────────────────────────────────────────────────
// Short zh-only labels used as area FILTER chips on the browse lists (Jobs /
// Secondhand / RealEstate / Events). These match the `area` values those
// listings store, so keep them distinct from the bilingual residence list above
// (swapping would break filtering). Previously duplicated verbatim in all 4
// pages — consolidated here.
export const GTA_FILTER_AREAS = [
  '多伦多市区', '北约克', '士嘉堡', '密西沙加', '万锦',
  '列治文山', '奥克维尔', '宾顿', '安省其他',
] as const
