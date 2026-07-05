// ─── Social Platform Display Config ──────────────────────────────────────────
// Shared by ServiceDetail and ProviderProfile.
export const SOCIAL_PLATFORMS = [
  { key: 'whatsapp',    label: 'WhatsApp',  icon: '📲', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', getUrl: (v: string) => `https://wa.me/${v.replace(/\D/g, '')}` },
  // 小红书 share text is usually "我在小红书收获了…>> https://xhslink.com/…" —
  // extract the embedded URL so the chip becomes clickable (a bare URL also works).
  { key: 'xiaohongshu', label: '小红书',    icon: '📕', color: 'bg-rose-50 text-rose-700 border-rose-200',         getUrl: (v: string) => v.match(/https?:\/\/\S+/)?.[0] ?? null },
  { key: 'instagram',   label: 'Instagram', icon: '📷', color: 'bg-pink-50 text-pink-700 border-pink-200',         getUrl: (v: string) => `https://instagram.com/${v.replace('@', '')}` },
  { key: 'facebook',    label: 'Facebook',  icon: '👥', color: 'bg-blue-50 text-blue-700 border-blue-200',         getUrl: (v: string) => v.startsWith('http') ? v : `https://facebook.com/${v}` },
  { key: 'line',        label: 'Line',      icon: '🟢', color: 'bg-green-50 text-green-700 border-green-200',      getUrl: (v: string) => `https://line.me/ti/p/~${v}` },
  { key: 'telegram',    label: 'Telegram',  icon: '✈️', color: 'bg-sky-50 text-sky-700 border-sky-200',            getUrl: (v: string) => `https://t.me/${v.replace('@', '')}` },
  { key: 'website',     label: '网站',      icon: '🌐', color: 'bg-violet-50 text-violet-700 border-violet-200',   getUrl: (v: string) => v.startsWith('http') ? v : `https://${v}` },
] as const
