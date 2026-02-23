/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import RegistrationFormEmbed from '@/components/landing/RegistrationFormEmbed'

// Mock Supabase client
const mockSignUp = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}))

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-1234'),
  },
  writable: true,
})

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

describe('RegistrationFormEmbed', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorageMock.clear()
  })

  describe('Form Rendering', () => {
    it('renders all form fields', () => {
      render(<RegistrationFormEmbed />)

      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send verification email/i })).toBeInTheDocument()
    })

    it('has proper ARIA attributes', () => {
      render(<RegistrationFormEmbed />)

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email/i)

      expect(firstNameInput).toHaveAttribute('aria-required', 'true')
      expect(lastNameInput).toHaveAttribute('aria-required', 'true')
      expect(emailInput).toHaveAttribute('aria-required', 'true')
    })
  })

  describe('Form Validation', () => {
    it('shows error when first name is empty', async () => {
      const user = userEvent.setup()
      render(<RegistrationFormEmbed />)

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      expect(await screen.findByText(/first name is required/i)).toBeInTheDocument()
    })

    it('shows error when last name is empty', async () => {
      const user = userEvent.setup()
      render(<RegistrationFormEmbed />)

      const firstNameInput = screen.getByLabelText(/first name/i)
      await user.type(firstNameInput, 'John')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      expect(await screen.findByText(/last name is required/i)).toBeInTheDocument()
    })

    it('shows error when email is empty', async () => {
      const user = userEvent.setup()
      render(<RegistrationFormEmbed />)

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    })

    it('shows error when email format is invalid', async () => {
      const user = userEvent.setup()
      render(<RegistrationFormEmbed />)

      const firstNameInput = screen.getByLabelText(/first name/i)
      const lastNameInput = screen.getByLabelText(/last name/i)
      const emailInput = screen.getByLabelText(/email/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'invalid-email')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument()
    })

    it('clears error when user starts typing', async () => {
      const user = userEvent.setup()
      render(<RegistrationFormEmbed />)

      // Trigger validation error
      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      expect(await screen.findByText(/first name is required/i)).toBeInTheDocument()

      // Start typing in first name
      const firstNameInput = screen.getByLabelText(/first name/i)
      await user.type(firstNameInput, 'J')

      // Error should be cleared
      expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('calls signUp with correct data', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({ data: { user: { id: '123' } }, error: null })

      render(<RegistrationFormEmbed />)

      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'john@example.com',
          password: expect.any(String),
          options: {
            emailRedirectTo: expect.stringContaining('/auth/callback?next=/login'),
            data: {
              first_name: 'John',
              last_name: 'Doe',
            },
          },
        })
      })
    })

    it('shows loading state during submission', async () => {
      const user = userEvent.setup()
      mockSignUp.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: { user: { id: '123' } }, error: null }), 100))
      )

      render(<RegistrationFormEmbed />)

      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      expect(screen.getByText(/sending\.\.\./i)).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('disables inputs during submission', async () => {
      const user = userEvent.setup()
      mockSignUp.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: { user: { id: '123' } }, error: null }), 100))
      )

      render(<RegistrationFormEmbed />)

      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      expect(screen.getByLabelText(/first name/i)).toBeDisabled()
      expect(screen.getByLabelText(/last name/i)).toBeDisabled()
      expect(screen.getByLabelText(/email/i)).toBeDisabled()
    })
  })

  describe('Success State', () => {
    it('shows success message after successful registration', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({ data: { user: { id: '123' } }, error: null })

      render(<RegistrationFormEmbed />)

      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument()
        expect(screen.getByText(/john@example.com/i)).toBeInTheDocument()
      })
    })

    it('stores registration data in sessionStorage', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({ data: { user: { id: '123' } }, error: null })

      render(<RegistrationFormEmbed />)

      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      await waitFor(() => {
        const stored = sessionStorage.getItem('registration-pending')
        expect(stored).toBeTruthy()
        const data = JSON.parse(stored!)
        expect(data.email).toBe('john@example.com')
        expect(data.timestamp).toBeDefined()
      })
    })

    it('restores success state from sessionStorage on mount', () => {
      sessionStorage.setItem(
        'registration-pending',
        JSON.stringify({ email: 'restored@example.com', timestamp: Date.now() })
      )

      render(<RegistrationFormEmbed />)

      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
      expect(screen.getByText(/restored@example.com/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('shows error for duplicate email', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      })

      render(<RegistrationFormEmbed />)

      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'existing@example.com')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/this email is already registered/i)).toBeInTheDocument()
        expect(screen.getByText(/go to login/i)).toBeInTheDocument()
      })
    })

    it('shows error for rate limiting', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'rate limit exceeded' },
      })

      render(<RegistrationFormEmbed />)

      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/too many requests/i)).toBeInTheDocument()
      })
    })

    it('shows generic error for other failures', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Something went wrong' },
      })

      render(<RegistrationFormEmbed />)

      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      })
    })

    it('keeps form data on error for retry', async () => {
      const user = userEvent.setup()
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Something went wrong' },
      })

      render(<RegistrationFormEmbed />)

      await user.type(screen.getByLabelText(/first name/i), 'John')
      await user.type(screen.getByLabelText(/last name/i), 'Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')

      const submitButton = screen.getByRole('button', { name: /send verification email/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      })

      // Form data should still be there
      expect(screen.getByDisplayValue('John')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument()
    })
  })
})
