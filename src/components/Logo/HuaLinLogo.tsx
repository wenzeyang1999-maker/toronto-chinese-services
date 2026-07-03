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
  const r         = size * 0.28

  const Badge = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hl-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1e40af" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="hl-shine" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Badge */}
      <rect width="40" height="40" rx={r} fill="url(#hl-bg)" />
      <rect width="40" height="40" rx={r} fill="url(#hl-shine)" />

      {/* 左树 (前景，全白) */}
      <polygon points="4,27 13,8 22,27" fill="white" />
      <rect x="10.5" y="27" width="5" height="6" rx="1.5" fill="white" />

      {/* 右树 (略透明，形成层次感) */}
      <polygon points="18,27 27,8 36,27" fill="white" opacity="0.72" />
      <rect x="24.5" y="27" width="5" height="6" rx="1.5" fill="white" opacity="0.72" />

      {/* 地面基线 */}
      <rect x="4" y="33" width="32" height="2" rx="1" fill="white" opacity="0.25" />
    </svg>
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
