/**
 * Gemini Embeddings
 *
 * Provides text embedding using Google's text-embedding-004 model (768 dimensions).
 */

import { getGeminiClient } from './client'
import type { Chunk } from '@/lib/rag/ingest'

const EMBEDDING_MODEL = 'text-embedding-004'
const BATCH_SIZE = 100

/**
 * Embed a single text string.
 * Returns a 768-dimensional float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const client = getGeminiClient()
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL })

  const result = await model.embedContent(text)
  const embedding = result.embedding.values

  if (!embedding || embedding.length === 0) {
    throw new Error('Gemini returned empty embedding')
  }

  return embedding
}

/**
 * Embed an array of chunks in batches.
 * Returns the same chunks with an `embedding` field attached.
 */
export async function embedChunks(
  chunks: Chunk[]
): Promise<Array<Chunk & { embedding: number[] }>> {
  const client = getGeminiClient()
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL })
  const results: Array<Chunk & { embedding: number[] }> = []

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    // Embed each chunk in the batch
    // Note: Gemini's batchEmbedContents expects an array of requests
    const batchResult = await model.batchEmbedContents({
      requests: batch.map((chunk) => ({
        content: { parts: [{ text: chunk.text }], role: 'user' },
      })),
    })

    for (let j = 0; j < batch.length; j++) {
      const embedding = batchResult.embeddings[j]?.values
      if (!embedding || embedding.length === 0) {
        throw new Error(`Gemini returned empty embedding for chunk ${i + j}`)
      }
      results.push({ ...batch[j], embedding })
    }
  }

  return results
}
