const SEARCH_EXPANSION_RULES: Array<[RegExp, string[]]> = [
  [/(漏水|水管|堵塞|下水|马桶|龙头)/, ['水管维修', '管道疏通', 'plumbing']],
  [/(搬家|搬运|货车|搬东西)/, ['本地搬家', '长途搬运', '搬运工']],
  [/(保洁|清洁|打扫|地毯|玻璃)/, ['日常保洁', '深度清洁', '地毯清洗']],
  [/(机场|接送|司机|包车)/, ['机场接送', '包车服务', '跨城接送']],
  [/(报税|税务|会计|cpa)/, ['报税会计', '税务咨询']],
  [/(钢琴|音乐|家教|补习|教练)/, ['钢琴教学', '中文家教', '数学家教']],
]

export function fallbackExpandedTerms(query: string): string[] {
  const lower = query.toLowerCase()
  const terms = new Set<string>()

  for (const [pattern, expanded] of SEARCH_EXPANSION_RULES) {
    if (pattern.test(lower)) expanded.forEach((term) => terms.add(term))
  }

  return Array.from(terms)
}
