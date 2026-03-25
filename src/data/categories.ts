import type { ServiceCategory } from '../types'

export interface CategoryConfig {
  id: ServiceCategory
  label: string
  emoji: string
  image: string
  color: string
  bgColor: string
  description: string
  searchTags: string[]
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'moving',
    label: '找搬家',
    emoji: '🚚',
    image: '/images/categories/moving.svg',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: '本地搬家、长途搬运、打包装箱',
    searchTags: ['搬家', '搬运', '打包', 'moving', '货车'],
  },
  {
    id: 'cleaning',
    label: '找保洁',
    emoji: '✨',
    image: '/images/categories/cleaning.svg',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    description: '日常保洁、深度清洁、搬家清洁',
    searchTags: ['保洁', '清洁', '打扫', 'cleaning', '卫生'],
  },
  {
    id: 'ride',
    label: '找接送',
    emoji: '🚗',
    image: '/images/categories/ride.svg',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    description: '机场接送、包车、顺风车',
    searchTags: ['接送', '包车', '机场', '顺风车', 'ride', '司机'],
  },
  {
    id: 'renovation',
    label: '找装修',
    emoji: '🔨',
    image: '/images/categories/renovation.svg',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    description: '室内装修、水电维修、家具安装',
    searchTags: ['装修', '维修', '水电', '安装', 'renovation', '工人'],
  },
  {
    id: 'cashwork',
    label: '现金工',
    emoji: '💰',
    image: '/images/categories/cashwork.svg',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: '临时工作、日结工资、灵活就业',
    searchTags: ['现金工', '日结', '临时工', '打工', 'cash job', '兼职'],
  },
  {
    id: 'food',
    label: '找餐饮',
    emoji: '🍜',
    image: '/images/categories/food.svg',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    description: '私房菜、外卖配送、厨师上门',
    searchTags: ['餐饮', '外卖', '私房菜', '厨师', 'food', '做饭'],
  },
]

export const getCategoryById = (id: ServiceCategory): CategoryConfig | undefined =>
  CATEGORIES.find((c) => c.id === id)
