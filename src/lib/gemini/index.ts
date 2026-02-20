/**
 * Gemini AI Module
 *
 * Unified exports for Gemini-based AI operations.
 */

export { getGeminiClient, clearGeminiClient } from './client'
export { embedText, embedChunks } from './embeddings'
export { streamChatResponse, chatCompletion } from './chat'

/** Embedding dimensions for Gemini text-embedding-004 */
export const EMBEDDING_DIMENSIONS = 768
