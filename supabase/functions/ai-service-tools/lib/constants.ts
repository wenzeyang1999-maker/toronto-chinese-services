export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const CATEGORY_LABELS: Record<string, string> = {
  moving: '搬家',
  cleaning: '保洁',
  ride: '接送',
  renovation: '装修',
  cashwork: '现金工',
  food: '餐饮',
  other: '其他',
}
