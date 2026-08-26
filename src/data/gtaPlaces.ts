// ─── GTA 地点坐标 + 地名识别 ───────────────────────────────────────────────────
// 用于「服务地点」:把「我在哪」和「我要在哪找服务」分开。
// 华邻地图搜索识别到地名(如「多伦多搬家」里的多伦多)→ 地图转过去、以该地点排序商家。
// MVP 用固定坐标表(城市中心);以后接 Google 地理编码支持任意地址/邮编。

export interface GtaPlace {
  label: string                 // 展示名(中文)
  lat: number
  lng: number
  aliases: string[]             // 识别用别名(小写,中英)
}

export const GTA_PLACES: GtaPlace[] = [
  { label: '多伦多市区', lat: 43.6532, lng: -79.3832, aliases: ['多伦多市区', '多伦多', '市中心', 'downtown', 'toronto'] },
  { label: '北约克',     lat: 43.7615, lng: -79.4111, aliases: ['北约克', 'north york', 'northyork'] },
  { label: '士嘉堡',     lat: 43.7764, lng: -79.2318, aliases: ['士嘉堡', '世嘉宝', 'scarborough'] },
  { label: '怡陶碧谷',   lat: 43.6205, lng: -79.5132, aliases: ['怡陶碧谷', 'etobicoke'] },
  { label: '万锦',       lat: 43.8561, lng: -79.3370, aliases: ['万锦', 'markham'] },
  { label: '列治文山',   lat: 43.8828, lng: -79.4403, aliases: ['列治文山', '列治文', 'richmond hill', 'richmondhill'] },
  { label: '旺市',       lat: 43.8361, lng: -79.4983, aliases: ['旺市', 'vaughan'] },
  { label: '密西沙加',   lat: 43.5890, lng: -79.6441, aliases: ['密西沙加', 'mississauga'] },
  { label: '宾顿',       lat: 43.7315, lng: -79.7624, aliases: ['宾顿', 'brampton'] },
  { label: '奥克维尔',   lat: 43.4675, lng: -79.6877, aliases: ['奥克维尔', 'oakville'] },
  { label: '阿积士',     lat: 43.8509, lng: -79.0204, aliases: ['阿积士', 'ajax'] },
  { label: '惠特比',     lat: 43.8975, lng: -78.9429, aliases: ['惠特比', 'whitby'] },
  { label: '新市',       lat: 44.0592, lng: -79.4613, aliases: ['新市', 'newmarket'] },
  { label: '奥罗拉',     lat: 44.0065, lng: -79.4504, aliases: ['奥罗拉', 'aurora'] },
  { label: '滑铁卢',     lat: 43.4643, lng: -80.5204, aliases: ['滑铁卢', 'waterloo'] },
  { label: '基奇纳',     lat: 43.4516, lng: -80.4925, aliases: ['基奇纳', 'kitchener'] },
  { label: '伦敦(安省)', lat: 42.9849, lng: -81.2453, aliases: ['伦敦'] , },
  { label: '汉密尔顿',   lat: 43.2557, lng: -79.8711, aliases: ['汉密尔顿', 'hamilton'] },
]

// 「快选」用的主要城市(华邻地图上一排 chip)。
export const QUICK_PLACES = GTA_PLACES.filter((p) =>
  ['多伦多市区', '北约克', '士嘉堡', '万锦', '列治文山', '密西沙加', '旺市'].includes(p.label)
)

// 从搜索词里识别地名。命中则返回 { place, rest }(rest = 去掉地名后的关键词,如「搬家」)。
// 优先匹配更长的别名,避免「列治文」被「多伦多」之类误吞。
export function detectPlace(query: string): { place: GtaPlace; rest: string } | null {
  const q = query.toLowerCase()
  let best: { place: GtaPlace; alias: string } | null = null
  for (const place of GTA_PLACES) {
    for (const a of place.aliases) {
      if (q.includes(a) && (!best || a.length > best.alias.length)) {
        best = { place, alias: a }
      }
    }
  }
  if (!best) return null
  // 去掉地名 + 常见连接词(的/在/附近/找）
  const rest = query
    .replace(new RegExp(best.alias, 'gi'), ' ')
    .replace(/[的在]|附近|周边|找/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { place: best.place, rest }
}
