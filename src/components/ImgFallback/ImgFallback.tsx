import { useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  src: string
  alt?: string
  className?: string
  loading?: 'lazy' | 'eager'
  fallback: ReactNode
}

/** Drop-in <img> that renders `fallback` when the image URL fails to load. */
export default function ImgFallback({ src, alt = '', className, loading = 'lazy', fallback }: Props) {
  const [failed, setFailed] = useState(false)
  if (failed) return <>{fallback}</>
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
    />
  )
}
