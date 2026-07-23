import { create } from 'zustand'

// 共享 AI 客服聊天窗的开合状态，让「底部导航 AI客服 tab」等外部入口也能打开它。
interface AiChatState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useAiChatStore = create<AiChatState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
