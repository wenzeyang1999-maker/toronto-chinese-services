export interface BrowseEntry {
  id: string; title: string; category: string; area: string | null; ts: number
}

export interface ChatSession {
  id: string; preview: string; ts: number; count: number
}

export type Section = 'account' | 'services' | 'messages' | 'browse' | 'chat'
