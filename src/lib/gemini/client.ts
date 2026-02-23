/**
 * Gemini Client
 *
 * Singleton client for Google Generative AI SDK.
 * Validates GOOGLE_API_KEY on first use.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

let clientInstance: GoogleGenerativeAI | null = null

/**
 * Get the singleton GoogleGenerativeAI client.
 * Throws if GOOGLE_API_KEY is not set.
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (clientInstance) {
    return clientInstance
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing GOOGLE_API_KEY environment variable. ' +
        'Get your free API key at: https://aistudio.google.com/'
    )
  }

  clientInstance = new GoogleGenerativeAI(apiKey)
  return clientInstance
}

/**
 * Clear the cached client instance.
 * Useful for testing or when environment variables change.
 */
export function clearGeminiClient(): void {
  clientInstance = null
}
