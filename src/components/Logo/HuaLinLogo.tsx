// ─── HuaLinLogo ───────────────────────────────────────────────────────────────
// 华邻品牌标志。
// Badge: 两棵白色树形 (象征"林"字) + 蓝色渐变背景
// variant="icon"  → badge only
// variant="full"  → badge + "华邻" wordmark + tagline
// theme="light"   → dark text (白底)
// theme="dark"    → all-white (深色背景)

interface Props {
  variant?: 'icon' | 'full'
  theme?: 'light' | 'dark'
  size?: number
  className?: string
}

export default function HuaLinLogo({
  variant   = 'full',
  theme     = 'light',
  size      = 32,
  className = '',
}: Props) {
  const textColor = theme === 'dark' ? '#ffffff' : '#111827'
  const subColor  = theme === 'dark' ? 'rgba(255,255,255,0.55)' : '#6b7280'

  // 「邻」字标 PNG(白底)。mix-blend-multiply 让白底在浅色背景下透出,只留蓝色 mark。
  const Badge = () => (
    <img
      src="/brand/logo-mark-nav.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ mixBlendMode: 'multiply', objectFit: 'contain', display: 'block' }}
    />
  )

  if (variant === 'icon') {
    return (
      <span className={className} aria-label="华邻">
        <Badge />
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="华邻 — 海外华人生活一站式服务平台">
      <Badge />
      <span className="flex flex-col leading-none select-none">
        <span
          style={{
            color:       textColor,
            fontWeight:  800,
            fontSize:    size * 0.56,
            letterSpacing: '0.05em',
            fontFamily:  '"Noto Sans SC", PingFang SC, "Microsoft YaHei", sans-serif',
            lineHeight:  1,
          }}
        >
          华邻
        </span>
        <span
          style={{
            color:       subColor,
            fontSize:    size * 0.28,
            letterSpacing: '0.04em',
            marginTop:   2,
            fontFamily:  '"Noto Sans SC", PingFang SC, sans-serif',
            lineHeight:  1,
          }}
        >
          海外华人生活
        </span>
      </span>
    </span>
  )
}
