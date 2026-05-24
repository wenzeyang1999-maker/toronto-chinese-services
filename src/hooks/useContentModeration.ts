// Content moderation client. Calls the moderate-content edge function with
// the user's session JWT — the edge function refuses anonymous callers, so
// only logged-in users can run moderation (and incur Groq cost).
import { supabase } from '../lib/supabase'

export interface ModerationResult {
  pass: boolean
  reason?: string
}

// Combines title + description + any extra fields into one string for review
export async function moderateContent(fields: Record<string, string | undefined>): Promise<ModerationResult> {
  const text = Object.values(fields).filter(Boolean).join('\n').trim()
  if (!text) return { pass: true }

  try {
    const { data, error } = await supabase.functions.invoke<ModerationResult>('moderate-content', {
      body: { text },
    })
    if (error || !data) return { pass: true }   // fail open
    return data
  } catch {
    return { pass: true }                       // network error → fail open
  }
}
