// ─── Saved Searches ───────────────────────────────────────────────────────────
// Client-side saved-search store backed by localStorage.
// When a new service matches a saved search it increments newCount — the app
// reads this on load to show notification badges without a server round-trip.
import type { Service } from '../types'

const KEY      = 'tcs_saved_searches'
const MAX_SAVED = 10

export interface SavedSearch {
  id:              string
  keyword:         string
  category?:       string
  label:           string   // human-readable: "搬家" or "搬家 · 保洁"
  createdAt:       number   // epoch ms
  lastCheckedAt:   number   // epoch ms — used to detect "new" results
  newCount:        number   // results newer than lastCheckedAt
}

export function getSavedSearches(): SavedSearch[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function write(searches: SavedSearch[]): void {
  localStorage.setItem(KEY, JSON.stringify(searches))
}

export function isSavedSearch(keyword: string, category?: string): boolean {
  return getSavedSearches().some(
    s => s.keyword.toLowerCase() === keyword.toLowerCase() && s.category === category
  )
}

export function saveSearch(keyword: string, category?: string): SavedSearch {
  const existing = getSavedSearches()
  const dupe = existing.find(
    s => s.keyword.toLowerCase() === keyword.toLowerCase() && s.category === category
  )
  if (dupe) return dupe

  const label = [keyword, category].filter(Boolean).join(' · ')
  const entry: SavedSearch = {
    id:            crypto.randomUUID(),
    keyword,
    category,
    label,
    createdAt:     Date.now(),
    lastCheckedAt: Date.now(),
    newCount:      0,
  }
  write([entry, ...existing].slice(0, MAX_SAVED))
  return entry
}

export function removeSavedSearch(id: string): void {
  write(getSavedSearches().filter(s => s.id !== id))
}

export function getTotalNewCount(): number {
  return getSavedSearches().reduce((sum, s) => sum + s.newCount, 0)
}

// Called after services load — update each saved search's newCount.
export function refreshNewCounts(services: Service[]): void {
  const searches = getSavedSearches()
  if (searches.length === 0) return
  const updated = searches.map(s => {
    const kw = s.keyword.toLowerCase()
    const newResults = services.filter(svc => {
      const isNew         = new Date(svc.createdAt).getTime() > s.lastCheckedAt
      const matchKeyword  = svc.title.toLowerCase().includes(kw) ||
                            svc.description.toLowerCase().includes(kw) ||
                            (svc.tags ?? []).some(t => t.toLowerCase().includes(kw))
      const matchCategory = !s.category || svc.category === s.category
      return isNew && matchKeyword && matchCategory
    })
    return { ...s, newCount: newResults.length }
  })
  write(updated)
}

// Mark all results as seen (called when user opens the search with a saved query).
export function markSearchSeen(id: string): void {
  write(getSavedSearches().map(s =>
    s.id === id ? { ...s, lastCheckedAt: Date.now(), newCount: 0 } : s
  ))
}
