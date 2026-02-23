import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import AuthCheckingSkeleton from '@/components/landing/skeletons/AuthCheckingSkeleton'
import HeroSection from '@/components/landing/HeroSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'

export default async function HomePage() {
  return (
    <Suspense fallback={<AuthCheckingSkeleton />}>
      <HomePageContent />
    </Suspense>
  )
}

async function HomePageContent() {
  // PERFORMANCE OPTIMIZATION: Fast cookie check
  // Skip Supabase call entirely if no session cookie exists (0ms vs 50-150ms)
  const cookieStore = await cookies()
  const hasSessionCookie = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'))

  // Fast path: No cookie = not authenticated, render immediately
  if (!hasSessionCookie) {
    return <LandingPage />
  }

  // Slow path: Validate session with Supabase (50-150ms)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Authenticated users should go to their workspaces
  if (user) {
    redirect('/workspaces')
  }

  return <LandingPage />
}

function LandingPage() {
  return (
    <>
      {/* Skip link for keyboard navigation */}
      <a
        href="#registration-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Skip to registration form
      </a>
      <main className="min-h-screen bg-white">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
      </main>
    </>
  )
}
