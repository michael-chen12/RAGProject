'use client'

import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = getSupabaseBrowserClient()
    const origin = window.location.origin

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (otpError) {
      setError(otpError.message)
    } else {
      setSubmitted(true)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-neutral-900 mb-2">
          Sign in
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          We&apos;ll send you a magic link to sign in.
        </p>

        {submitted ? (
          <div role="status" className="text-sm text-green-600 bg-green-50 rounded-md p-3">
            Check your email — we sent a magic link to <strong>{email}</strong>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand hover:bg-brand-hover text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
