// ─── Skeleton primitives ───────────────────────────────────────────────────────
// Lightweight shimmer building-blocks. Compose them to match any real layout.

interface BoxProps {
  className?: string
}

/** Single shimmer block */
export function SkeletonBox({ className = '' }: BoxProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
  )
}

/** Pre-composed skeleton that mirrors a ServiceCard (list layout) */
export function ServiceCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 p-3">
      <SkeletonBox className="w-[72px] h-[72px] flex-shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex gap-2">
          <SkeletonBox className="h-4 flex-1 rounded-lg" />
          <SkeletonBox className="h-4 w-16 flex-shrink-0 rounded-lg" />
        </div>
        <SkeletonBox className="h-3 w-3/4 rounded-lg" />
        <div className="flex gap-1.5">
          <SkeletonBox className="h-4 w-14 rounded-full" />
          <SkeletonBox className="h-4 w-20 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** Repeats ServiceCardSkeleton n times */
export function ServiceListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <ServiceCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Provider profile page skeleton */
export function ProviderProfileSkeleton() {
  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-5 space-y-4">
      {/* Profile card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-4">
          <SkeletonBox className="w-20 h-20 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-5 w-40 rounded-lg" />
            <SkeletonBox className="h-3 w-28 rounded-lg" />
            <div className="flex gap-2 mt-2">
              <SkeletonBox className="h-5 w-20 rounded-full" />
              <SkeletonBox className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <SkeletonBox className="h-3 w-full rounded-lg" />
        <SkeletonBox className="h-3 w-2/3 rounded-lg mt-2" />
        <div className="flex gap-3 mt-5">
          <SkeletonBox className="h-11 flex-1 rounded-2xl" />
          <SkeletonBox className="h-11 w-24 rounded-2xl" />
        </div>
      </div>

      {/* Service grid */}
      <div>
        <SkeletonBox className="h-4 w-32 rounded-lg mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <SkeletonBox className="w-full aspect-square rounded-none" />
              <div className="p-4 space-y-2">
                <SkeletonBox className="h-3 w-3/4 rounded-lg" />
                <SkeletonBox className="h-3 w-1/2 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Service detail page skeleton */
export function ServiceDetailSkeleton() {
  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Main card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-start gap-3">
          <SkeletonBox className="w-14 h-14 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-5 w-3/4 rounded-lg" />
            <div className="flex gap-2">
              <SkeletonBox className="h-4 w-16 rounded-full" />
              <SkeletonBox className="h-4 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <SkeletonBox className="h-3 w-full rounded-lg" />
        <SkeletonBox className="h-3 w-5/6 rounded-lg" />
        <SkeletonBox className="h-3 w-4/6 rounded-lg" />
        <div className="flex gap-2">
          <SkeletonBox className="h-5 w-20 rounded-full" />
          <SkeletonBox className="h-5 w-24 rounded-full" />
        </div>
      </div>

      {/* Provider card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
        <SkeletonBox className="h-4 w-24 rounded-lg mb-3" />
        <div className="flex items-center gap-3">
          <SkeletonBox className="w-12 h-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-4 w-32 rounded-lg" />
            <SkeletonBox className="h-3 w-24 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Generic section skeleton for Profile sections */
export function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="px-4 py-5 space-y-2.5 max-w-md lg:max-w-none mx-auto w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-4 py-3.5">
          <SkeletonBox className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-3.5 w-3/4 rounded-lg" />
            <SkeletonBox className="h-3 w-1/2 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}
