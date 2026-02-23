'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

interface FormData {
  firstName: string
  lastName: string
  email: string
}

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  general?: string
}

export default function RegistrationFormEmbed() {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  // Check sessionStorage on mount for pending registration
  useEffect(() => {
    const pending = sessionStorage.getItem('registration-pending')
    if (pending) {
      try {
        const data = JSON.parse(pending)
        setIsRegistered(true)
        setRegisteredEmail(data.email)
      } catch {
        sessionStorage.removeItem('registration-pending')
      }
    }
  }, [])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous errors
    setErrors({})

    // Validate form
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()

      // Sign up with random password (passwordless flow)
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: crypto.randomUUID(), // Random password user won't know
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/login`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        },
      })

      if (error) {
        // Handle specific error cases
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          setErrors({
            email: 'This email is already registered.',
            general: 'Already have an account?',
          })
        } else if (error.message.includes('rate limit')) {
          setErrors({
            general: 'Too many requests. Please wait a moment and try again.',
          })
        } else {
          setErrors({
            general: error.message || 'An error occurred. Please try again.',
          })
        }
        return
      }

      if (data.user) {
        // Store in sessionStorage for persistence across reloads
        sessionStorage.setItem(
          'registration-pending',
          JSON.stringify({
            email: formData.email,
            timestamp: Date.now(),
          })
        )

        // Show success state
        setRegisteredEmail(formData.email)
        setIsRegistered(true)
      }
    } catch (err) {
      setErrors({
        general: 'Network error. Please check your connection and try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  // Success state
  if (isRegistered) {
    return (
      <div className="rounded-lg bg-white p-8 shadow-lg border border-neutral-200">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-neutral-900">Check Your Email</h2>
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-md bg-green-50 border border-green-200 p-4"
          >
            <p className="text-sm text-green-800">
              We&apos;ve sent a verification email to:
              <br />
              <strong className="font-medium">{registeredEmail}</strong>
            </p>
          </div>
          <p className="mt-4 text-sm text-neutral-600">
            Click the link in the email to verify your account. After verification, you&apos;ll be
            redirected to the login page.
          </p>
          <p className="mt-4 text-xs text-neutral-500">
            Didn&apos;t receive the email? Check your spam folder.
          </p>
        </div>
      </div>
    )
  }

  // Registration form
  return (
    <div
      id="registration-form"
      className="rounded-lg bg-white p-8 shadow-lg border border-neutral-200"
    >
      <h2 className="text-xl font-semibold text-neutral-900 mb-2">Get Started Free</h2>
      <p className="text-sm text-neutral-600 mb-6">Create your account to start building.</p>

      {errors.general && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 flex items-start"
        >
          <svg
            className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-red-800">
            <p>{errors.general}</p>
            {errors.email?.includes('already registered') && (
              <a href="/login" className="underline font-medium mt-1 inline-block">
                Go to login
              </a>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* First Name */}
        <div>
          <label htmlFor="first-name" className="block text-sm font-medium text-neutral-700 mb-1">
            First Name
          </label>
          <input
            type="text"
            id="first-name"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange('firstName')}
            disabled={isSubmitting}
            required
            aria-required="true"
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? 'first-name-error' : undefined}
            className={`block w-full rounded-md border ${
              errors.firstName
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-neutral-300 focus:border-indigo-500 focus:ring-indigo-500'
            } px-3 py-2 shadow-sm focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          {errors.firstName && (
            <p id="first-name-error" role="alert" className="mt-1 text-sm text-red-600">
              {errors.firstName}
            </p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="last-name" className="block text-sm font-medium text-neutral-700 mb-1">
            Last Name
          </label>
          <input
            type="text"
            id="last-name"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange('lastName')}
            disabled={isSubmitting}
            required
            aria-required="true"
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? 'last-name-error' : undefined}
            className={`block w-full rounded-md border ${
              errors.lastName
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-neutral-300 focus:border-indigo-500 focus:ring-indigo-500'
            } px-3 py-2 shadow-sm focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          {errors.lastName && (
            <p id="last-name-error" role="alert" className="mt-1 text-sm text-red-600">
              {errors.lastName}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange('email')}
            disabled={isSubmitting}
            required
            aria-required="true"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={`block w-full rounded-md border ${
              errors.email
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-neutral-300 focus:border-indigo-500 focus:ring-indigo-500'
            } px-3 py-2 shadow-sm focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="mt-1 text-sm text-red-600">
              {errors.email}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Sending...
            </span>
          ) : (
            'Send Verification Email'
          )}
        </button>

        <p className="text-xs text-neutral-500 text-center">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>
    </div>
  )
}
