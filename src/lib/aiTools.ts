import { supabase } from './supabase'

export async function expandSemanticSearch(query: string): Promise<string[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  try {
    const { data, error } = await supabase.functions.invoke('ai-service-tools', {
      body: { action: 'expand_search', payload: { query: trimmed } },
    })
    if (error) throw error
    return Array.isArray(data?.terms) ? data.terms.map((term: unknown) => String(term)).filter(Boolean) : []
  } catch (err) {
    console.warn('[ai-tools] expand search failed:', err)
    return []
  }
}

export async function generateServiceDraft(payload: {
  categoryId: string
  title: string
  keywords: string
  serviceAreas: string[]
  priceType: string
  imageCount: number
}): Promise<{ title: string; description: string; tags: string[] } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-service-tools', {
      body: { action: 'draft_service', payload },
    })
    if (error) throw error

    if (!data || typeof data !== 'object') return null
    return {
      title: String((data as Record<string, unknown>).title ?? '').trim(),
      description: String((data as Record<string, unknown>).description ?? '').trim(),
      tags: Array.isArray((data as Record<string, unknown>).tags)
        ? ((data as Record<string, unknown>).tags as unknown[]).map((tag) => String(tag).trim()).filter(Boolean)
        : [],
    }
  } catch (err) {
    console.warn('[ai-tools] draft service failed:', err)
    return null
  }
}
