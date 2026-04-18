// ─── Match & Email Providers ──────────────────────────────────────────────────
// Legacy client helper kept for compatibility.
//
// Important:
// - Do NOT write inquiry_matches from the browser.
// - All provider matching / email dispatch now runs inside the
//   match-inquiry-providers Edge Function using service role.
import { supabase } from './supabase'

export interface InquiryInput {
  inquiryId:     string
  categoryId:    string
  categoryLabel: string
  description:   string
  budget:        string
  timing:        string   // 'asap' | 'flexible' | 'next_week'
  name:          string
  phone:         string
  wechat:        string
}

export interface MatchResult {
  sent:  number   // how many emails were dispatched
  total: number   // how many unique matching providers were found
}

export async function matchAndEmailProviders(inquiry: InquiryInput): Promise<MatchResult> {
  const { data, error } = await supabase.functions.invoke('match-inquiry-providers', {
    body: inquiry,
  })

  if (error) {
    console.warn('[matchAndEmail] edge function failed:', error.message)
    return { sent: 0, total: 0 }
  }

  return {
    sent: typeof data?.sent === 'number' ? data.sent : 0,
    total: typeof data?.total === 'number' ? data.total : 0,
  }
}
