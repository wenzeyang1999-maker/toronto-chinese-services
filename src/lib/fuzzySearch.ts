import Fuse from 'fuse.js'
import type { ServiceRequest, Service } from '../types'
import { CATEGORIES } from '../data/categories'

// ── Synonym expansion ──────────────────────────────────────────────────────────
// Maps common query terms to expanded keyword sets so that e.g. "修马桶"
// also returns results tagged with "handyman", "renovation", "plumber", etc.
// Keys are lowercased. Values are added to the search query as alternatives.
const SYNONYM_MAP: Record<string, string[]> = {
  '修马桶': ['马桶', 'plumber', 'handyman', '水管', '维修', 'renovation'],
  '通马桶': ['马桶', '堵塞', 'plumber', 'handyman', '水管'],
  '水管漏水': ['水管', 'plumber', '漏水', 'handyman', '维修'],
  '修水管': ['水管', 'plumber', 'handyman', '维修'],
  '修厕所': ['厕所', '马桶', 'plumber', 'handyman', '维修'],
  '修电': ['电工', 'electrician', '电路', '维修'],
  '修门': ['木工', 'carpenter', 'handyman', '维修'],
  '铺地板': ['地板', 'flooring', 'carpenter', '装修'],
  '贴砖': ['瓷砖', 'tile', '装修'],
  '油漆': ['粉刷', 'painting', '装修'],
  '装家具': ['家具', '安装', 'handyman', 'assembly'],
  '搬东西': ['搬家', 'moving', '搬运'],
  '打扫房子': ['保洁', 'cleaning', '清洁'],
  '洗厕所': ['保洁', 'cleaning', '清洁'],
  '接机': ['机场', '接送', 'airport', 'pickup'],
  '送机': ['机场', '接送', 'airport'],
  '帮忙修理': ['维修', 'handyman', 'repair', '修理'],
  'handyman': ['维修', '修理', '装修', '水管', '电工', '木工'],
  'plumber': ['水管', '马桶', '漏水', '水电', '维修'],
  'electrician': ['电工', '水电', '电路', '维修'],
  'cleaning': ['保洁', '清洁', '打扫'],
  'moving': ['搬家', '搬运', '打包'],
  'driver': ['接送', '司机', '代驾'],
}

function expandQuery(query: string): string[] {
  const q = query.toLowerCase().trim()
  const extras = new Set<string>()
  for (const [key, vals] of Object.entries(SYNONYM_MAP)) {
    if (q.includes(key) || key.includes(q)) {
      vals.forEach(v => extras.add(v))
    }
  }
  return [q, ...extras]
}

// ── Category tag expansion ─────────────────────────────────────────────────────
// Returns a flat string of all tags for a category ID, used as a search field.
function categoryText(categoryId: string): string {
  const cat = CATEGORIES.find(c => c.id === categoryId)
  if (!cat) return categoryId
  return [cat.label, cat.description, ...cat.searchTags].join(' ')
}

// ── Service fuzzy search ───────────────────────────────────────────────────────
interface SearchableService {
  _id: string
  _search: string
}

export function fuzzyFilterServices(services: Service[], query: string): Service[] {
  if (!query.trim()) return services

  const terms = expandQuery(query)

  // Build a flat searchable document per service
  const docs: SearchableService[] = services.map(s => ({
    _id: s.id,
    _search: [
      s.title,
      s.provider.name,
      s.description ?? '',
      categoryText(s.category),
    ].join(' '),
  }))

  const fuse = new Fuse(docs, {
    keys: ['_search'],
    threshold: 0.35,      // 0 = perfect match only, 1 = match anything
    ignoreLocation: true, // don't penalise matches deep in the string
    minMatchCharLength: 2,
  })

  const matched = new Set<string>()

  for (const term of terms) {
    fuse.search(term).forEach(r => matched.add(r.item._id))
  }

  // Preserve original order, prioritise exact substring matches
  return services
    .filter(s => matched.has(s.id))
    .sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
      const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
      return aExact - bExact
    })
}

// ── ServiceRequest fuzzy search ───────────────────────────────────────────────
interface SearchableRequest {
  _id: string
  _search: string
}

export function fuzzyFilterRequests(requests: ServiceRequest[], query: string): ServiceRequest[] {
  if (!query.trim()) return requests

  const terms = expandQuery(query)

  const docs: SearchableRequest[] = requests.map(r => ({
    _id: r.id,
    _search: [
      r.title,
      r.description ?? '',
      r.area ?? '',
      categoryText(r.category),
    ].join(' '),
  }))

  const fuse = new Fuse(docs, {
    keys: ['_search'],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })

  const matched = new Set<string>()

  for (const term of terms) {
    fuse.search(term).forEach(r => matched.add(r.item._id))
  }

  return requests
    .filter(r => matched.has(r.id))
    .sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
      const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1
      return aExact - bExact
    })
}
