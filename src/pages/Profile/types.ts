export type { BrowseEntry } from '../../types/browse'

export interface ChatSession {
  id: string; preview: string; ts: number; count: number
}

export type Section = 'account' | 'services' | 'saves' | 'follows' | 'stats' | 'messages' | 'browse' | 'chat' | 'verification' | 'membership' | 'community' | 'referral'
