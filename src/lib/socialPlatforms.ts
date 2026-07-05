// ─── Social Platform Display Config ──────────────────────────────────────────
// Shared by ServiceDetail and ProviderProfile.
// Pulls the first URL out of a value (users often paste a whole share sentence
// like "…来看看我的主页>> https://xhslink.com/…"). Returns null if none.
const embeddedUrl = (v: string): string | null => v.match(/https?:\/\/\S+/)?.[0] ?? null

export const SOCIAL_PLATFORMS = [
  { key: 'whatsapp',    label: 'WhatsApp',  icon: '📲', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', getUrl: (v: string) => embeddedUrl(v) ?? `https://wa.me/${v.replace(/\D/g, '')}` },
  // 小红书 has no handle format — only a share link is usable, so null when absent.
  { key: 'xiaohongshu', label: '小红书',    icon: '📕', color: 'bg-rose-50 text-rose-700 border-rose-200',         getUrl: (v: string) => embeddedUrl(v) },
  { key: 'instagram',   label: 'Instagram', icon: '📷', color: 'bg-pink-50 text-pink-700 border-pink-200',         getUrl: (v: string) => embeddedUrl(v) ?? `https://instagram.com/${v.trim().replace('@', '')}` },
  { key: 'facebook',    label: 'Facebook',  icon: '👥', color: 'bg-blue-50 text-blue-700 border-blue-200',         getUrl: (v: string) => embeddedUrl(v) ?? `https://facebook.com/${v.trim()}` },
  { key: 'line',        label: 'Line',      icon: '🟢', color: 'bg-green-50 text-green-700 border-green-200',      getUrl: (v: string) => embeddedUrl(v) ?? `https://line.me/ti/p/~${v.trim()}` },
  { key: 'telegram',    label: 'Telegram',  icon: '✈️', color: 'bg-sky-50 text-sky-700 border-sky-200',            getUrl: (v: string) => embeddedUrl(v) ?? `https://t.me/${v.trim().replace('@', '')}` },
  { key: 'website',     label: '网站',      icon: '🌐', color: 'bg-violet-50 text-violet-700 border-violet-200',   getUrl: (v: string) => embeddedUrl(v) ?? `https://${v.trim()}` },
] as const
