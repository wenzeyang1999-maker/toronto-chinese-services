export const POST_TYPE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  recommend:   { label: '求推荐', emoji: '🙏', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  experience:  { label: '经验分享', emoji: '💡', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  question:    { label: '问个问题', emoji: '❓', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  secondhand:  { label: '随手转让', emoji: '🛍️', color: 'bg-green-50 text-green-600 border-green-200' },
}

export const AREA_CONFIG: Record<string, string> = {
  north_york:   'North York',
  markham:      'Markham',
  mississauga:  'Mississauga',
  scarborough:  'Scarborough',
  downtown:     'Downtown',
  brampton:     'Brampton',
  other:        '其他地区',
}
