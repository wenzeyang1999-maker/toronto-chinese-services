// ─── 城市 / 三级地区（大洲 → 国家 → 城市）─────────────────────────────────────
// 说明书 §2：平台初期按城市级围栏控制服务范围。目前仅「多伦多」开通；其余城市
// 结构已就位、标记「即将开通」，未来上线只需把 opened 置 true。
//
// 自动定位判定用「与开通城市中心的距离」（见 nearestOpenedCity），避免额外反查
// 地理请求；三级树用于手动选择（跨城帮亲友发单）。

export interface City {
  id: string
  name: string
  lat: number
  lng: number
  radiusKm: number   // 该城市服务半径（判定"在本城"用）
  opened: boolean
}

export interface CountryNode {
  id: string
  name: string
  cities: City[]
}

export interface ContinentNode {
  id: string
  name: string
  countries: CountryNode[]
}

// 三级地区树（大洲 → 国家 → 城市）
export const REGION_TREE: ContinentNode[] = [
  {
    id: 'north-america', name: '北美洲',
    countries: [
      {
        id: 'canada', name: '加拿大',
        cities: [
          { id: 'toronto',   name: '多伦多',   lat: 43.6532, lng: -79.3832, radiusKm: 150, opened: true  },
          { id: 'vancouver', name: '温哥华',   lat: 49.2827, lng: -123.1207, radiusKm: 120, opened: false },
          { id: 'montreal',  name: '蒙特利尔', lat: 45.5019, lng: -73.5674, radiusKm: 100, opened: false },
          { id: 'calgary',   name: '卡尔加里', lat: 51.0447, lng: -114.0719, radiusKm: 100, opened: false },
          { id: 'ottawa',    name: '渥太华',   lat: 45.4215, lng: -75.6972, radiusKm: 80,  opened: false },
        ],
      },
      {
        id: 'usa', name: '美国',
        cities: [
          { id: 'new-york',      name: '纽约',   lat: 40.7128,  lng: -74.0060,  radiusKm: 120, opened: false },
          { id: 'los-angeles',   name: '洛杉矶', lat: 34.0522,  lng: -118.2437, radiusKm: 150, opened: false },
          { id: 'san-francisco', name: '旧金山', lat: 37.7749,  lng: -122.4194, radiusKm: 120, opened: false },
          { id: 'seattle',       name: '西雅图', lat: 47.6062,  lng: -122.3321, radiusKm: 100, opened: false },
        ],
      },
    ],
  },
  {
    id: 'europe', name: '欧洲',
    countries: [
      {
        id: 'uk', name: '英国',
        cities: [
          { id: 'london',     name: '伦敦',   lat: 51.5074, lng: -0.1278,  radiusKm: 120, opened: false },
          { id: 'manchester', name: '曼彻斯特', lat: 53.4808, lng: -2.2426,  radiusKm: 80,  opened: false },
        ],
      },
      {
        id: 'france', name: '法国',
        cities: [
          { id: 'paris', name: '巴黎', lat: 48.8566, lng: 2.3522, radiusKm: 100, opened: false },
        ],
      },
      {
        id: 'germany', name: '德国',
        cities: [
          { id: 'berlin', name: '柏林', lat: 52.5200, lng: 13.4050, radiusKm: 100, opened: false },
          { id: 'munich', name: '慕尼黑', lat: 48.1351, lng: 11.5820, radiusKm: 80,  opened: false },
        ],
      },
    ],
  },
  {
    id: 'oceania', name: '大洋洲',
    countries: [
      {
        id: 'australia', name: '澳大利亚',
        cities: [
          { id: 'sydney',    name: '悉尼',   lat: -33.8688, lng: 151.2093, radiusKm: 120, opened: false },
          { id: 'melbourne', name: '墨尔本', lat: -37.8136, lng: 144.9631, radiusKm: 120, opened: false },
          { id: 'brisbane',  name: '布里斯班', lat: -27.4698, lng: 153.0251, radiusKm: 100, opened: false },
          { id: 'perth',     name: '珀斯',   lat: -31.9505, lng: 115.8605, radiusKm: 100, opened: false },
        ],
      },
      {
        id: 'new-zealand', name: '新西兰',
        cities: [
          { id: 'auckland',   name: '奥克兰', lat: -36.8485, lng: 174.7633, radiusKm: 100, opened: false },
          { id: 'wellington', name: '惠灵顿', lat: -41.2865, lng: 174.7762, radiusKm: 80,  opened: false },
        ],
      },
    ],
  },
  {
    id: 'middle-east', name: '中东',
    countries: [
      {
        id: 'uae', name: '阿联酋',
        cities: [
          { id: 'dubai',     name: '迪拜',   lat: 25.2048, lng: 55.2708, radiusKm: 100, opened: false },
          { id: 'abu-dhabi', name: '阿布扎比', lat: 24.4539, lng: 54.3773, radiusKm: 80,  opened: false },
        ],
      },
    ],
  },
]

// 扁平化所有城市 / 仅开通城市
export const ALL_CITIES: City[] = REGION_TREE.flatMap(c => c.countries.flatMap(co => co.cities))
export const OPENED_CITIES: City[] = ALL_CITIES.filter(c => c.opened)
export const DEFAULT_CITY: City = OPENED_CITIES[0] // 多伦多

export function getCityById(id: string | null | undefined): City | null {
  if (!id) return null
  return ALL_CITIES.find(c => c.id === id) ?? null
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 给一个坐标，返回它落在的「开通城市」（在其服务半径内），否则 null。
export function nearestOpenedCity(lat: number, lng: number): City | null {
  let best: City | null = null
  let bestKm = Infinity
  for (const c of OPENED_CITIES) {
    const km = haversineKm(lat, lng, c.lat, c.lng)
    if (km <= c.radiusKm && km < bestKm) { best = c; bestKm = km }
  }
  return best
}
