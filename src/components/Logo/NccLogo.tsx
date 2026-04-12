// ─── NccLogo ──────────────────────────────────────────────────────────────────
// Professional NCC brand mark for header and other branded surfaces.
// variant="icon"   → square badge only (favicon / compact)
// variant="full"   → badge + "NCC" wordmark + optional tagline
// theme="light"    → blue badge, dark text (default, for white backgrounds)
// theme="dark"     → all-white version (for dark hero headers)

interface Props {
  variant?: 'icon' | 'full'
  theme?: 'light' | 'dark'
  size?: number          // controls badge height in px
  className?: string
}

export default function NccLogo({
  variant = 'full',
  theme   = 'light',
  size    = 32,
  className = '',
}: Props) {
  const textColor    = theme === 'dark' ? '#ffffff' : '#111827'
  const subColor     = theme === 'dark' ? 'rgba(255,255,255,0.55)' : '#6b7280'
  const badgeRadius  = size * 0.28

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
        <linearGradient id="ncc-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        {/* subtle inner glow */}
        <linearGradient id="ncc-shine" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Badge background */}
      <rect width="40" height="40" rx={badgeRadius} fill="url(#ncc-grad)" />
      {/* Shine overlay */}
      <rect width="40" height="40" rx={badgeRadius} fill="url(#ncc-shine)" />

      {/* Stylised N mark — two verticals connected by a diagonal */}
      <path
        d="M10 29 L10 11 L20 24 L30 11 L30 29"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Maple-leaf accent dot — bottom-right */}
      <circle cx="32" cy="32" r="3.5" fill="white" opacity="0.35" />
    </svg>
  )

  if (variant === 'icon') {
    return (
      <span className={className} aria-label="NCC">
        <Badge />
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="NCC 北美华人圈">
      <Badge />
      <span className="flex flex-col leading-none select-none">
        <span
          style={{
            color: textColor,
            fontWeight: 800,
            fontSize: size * 0.55,
            letterSpacing: '0.04em',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: 1,
          }}
        >
          NCC
        </span>
        <span
          style={{
            color: subColor,
            fontSize: size * 0.30,
            letterSpacing: '0.06em',
            marginTop: 2,
            fontFamily: '"Noto Sans SC", PingFang SC, sans-serif',
            lineHeight: 1,
          }}
        >
          北美华人圈
        </span>
      </span>
    </span>
  )
}
