import { create } from 'zustand'

// 全局「发需求」(AI 帮你找) 弹窗控制 + 当前页类别语境。
// - openInquiry(catId) 可从任意页面打开发需求并预填类别；
// - 带类别语境的页面(类别页/搜索页/服务详情)在挂载时 setPageCategory，
//   卸载时 clearPageCategory；发布面板/发需求入口据此预选类别，免用户再选。
interface InquiryState {
  open: boolean
  presetCategoryId: string   // 打开弹窗时用来预选的类别 id
  pageCategoryId: string     // 当前页的类别语境（由页面声明）
  openInquiry: (categoryId?: string) => void
  close: () => void
  setPageCategory: (categoryId: string) => void
  clearPageCategory: () => void
}

export const useInquiryStore = create<InquiryState>((set) => ({
  open: false,
  presetCategoryId: '',
  pageCategoryId: '',
  openInquiry: (categoryId) => set({ open: true, presetCategoryId: categoryId ?? '' }),
  close: () => set({ open: false }),
  setPageCategory: (categoryId) => set({ pageCategoryId: categoryId }),
  clearPageCategory: () => set({ pageCategoryId: '' }),
}))
