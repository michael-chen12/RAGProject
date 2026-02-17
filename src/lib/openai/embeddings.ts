import OpenAI from 'openai'
import type { Chunk } from '@/lib/rag/ingest'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const EMBEDDING_MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 100

/**
 * Embeds a single string. Returns a 1536-dimensional float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Embeds an array of chunks in batches of 100 (OpenAI's recommended batch size).
 * Returns the same chunks with an `embedding` field attached.
 */
export async function embedChunks(
  chunks: Chunk[]
): Promise<Array<Chunk & { embedding: number[] }>> {
  const results: Array<Chunk & { embedding: number[] }> = []

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((c) => c.text),
    })
    for (let j = 0; j < batch.length; j++) {
      results.push({ ...batch[j], embedding: response.data[j].embedding })
    }
  }

  return results
}
