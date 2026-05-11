const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const MODERATE_URL      = `${SUPABASE_URL}/functions/v1/moderate-content`

export interface ModerationResult {
  pass: boolean
  reason?: string
}

// Combines title + description + any extra fields into one string for review
export async function moderateContent(fields: Record<string, string | undefined>): Promise<ModerationResult> {
  const text = Object.values(fields).filter(Boolean).join('\n').trim()
  if (!text) return { pass: true }

  try {
    const res = await fetch(MODERATE_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body:   JSON.stringify({ text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { pass: true }   // fail open
    return await res.json() as ModerationResult
  } catch {
    return { pass: true }                // network error → fail open
  }
}
