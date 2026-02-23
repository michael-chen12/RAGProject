export default function AuthCheckingSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Checking authentication status"
      className="min-h-screen bg-gradient-to-br from-indigo-50 to-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 md:py-32">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          {/* Hero text skeleton */}
          <div className="space-y-6">
            <div className="h-12 bg-neutral-200 rounded-lg animate-pulse w-3/4" />
            <div className="h-12 bg-neutral-200 rounded-lg animate-pulse w-full" />
            <div className="space-y-3 mt-6">
              <div className="h-6 bg-neutral-200 rounded animate-pulse w-full" />
              <div className="h-6 bg-neutral-200 rounded animate-pulse w-5/6" />
            </div>
          </div>

          {/* Form skeleton */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="h-8 bg-neutral-200 rounded animate-pulse w-2/3 mb-6" />
            <div className="space-y-4">
              <div className="h-10 bg-neutral-200 rounded animate-pulse" />
              <div className="h-10 bg-neutral-200 rounded animate-pulse" />
              <div className="h-10 bg-neutral-200 rounded animate-pulse" />
              <div className="h-11 bg-neutral-200 rounded-md animate-pulse mt-6" />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  )
}
