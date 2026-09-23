// ─── 语言(简体 / 繁体)──────────────────────────────────────────────────────
// 简↔繁是机械字符转换,不改代码文案:选繁体时运行时整站转(见 lib/traditionalize)。
// 英/法后续再上(需真人翻译),故先只两档。切换时整页刷新,干净地应用/还原。
import { create } from 'zustand'

export type Lang = 'zh-CN' | 'zh-TW' | 'en' | 'fr'

export function readLang(): Lang {
  try {
    const v = localStorage.getItem('tcs_lang')
    return (v === 'zh-TW' || v === 'en' || v === 'fr') ? v : 'zh-CN'
  } catch { return 'zh-CN' }
}

interface LangState { lang: Lang; setLang: (l: Lang) => void }

export const useLangStore = create<LangState>((set) => ({
  lang: readLang(),
  setLang: (l) => {
    try { localStorage.setItem('tcs_lang', l) } catch { /* ignore */ }
    set({ lang: l })
    window.location.reload()   // 刷新以干净应用(繁→简的就地还原很难,重载最稳)
  },
}))
