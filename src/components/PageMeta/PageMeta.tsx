// ─── PageMeta ─────────────────────────────────────────────────────────────────
// Sets Open Graph + Twitter Card meta tags dynamically per page.
// Uses react-helmet-async (Helmet must be wrapped in HelmetProvider in main.tsx).
//
// Usage:
//   <PageMeta title="出仓鼠 · 二手交易" description="免费领养" image={url} />
import { Helmet } from 'react-helmet-async'

interface Props {
  title?:       string
  description?: string
  image?:       string
  /** Canonical URL — defaults to window.location.href */
  url?:         string
}

const SITE_NAME = '大多伦多华人服务平台'
const DEFAULT_TITLE = '大多伦多华人服务平台 — 找服务·招聘·房源·二手·活动'
const DEFAULT_DESC  = '大多伦多华人一站式生活服务平台，涵盖本地服务、招聘求职、租房买房、二手交易和同城活动。'
const DEFAULT_IMAGE = 'https://toronto-chinese-services.vercel.app/og-default.png'

export default function PageMeta({ title, description, image, url }: Props) {
  const fullTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE
  const desc      = description ?? DEFAULT_DESC
  const img       = image ?? DEFAULT_IMAGE
  const canonical = url ?? (typeof window !== 'undefined' ? window.location.href : '')

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />

      {/* Open Graph */}
      <meta property="og:type"        content="website" />
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image"       content={img} />
      {canonical && <meta property="og:url" content={canonical} />}

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image"       content={img} />
    </Helmet>
  )
}
