/**
 * Unit tests for the document ingestion pipeline.
 * Tests cover: chunk count, overlap correctness, trailing chunk discard,
 * empty input, and embedding dimension via a mocked OpenAI client.
 */

// ── Mock tiktoken so tests run without the WASM binary ───────────────────────
// Simulate cl100k_base: each ASCII character = 1 token (simple approximation).
jest.mock('tiktoken', () => {
  const enc = {
    encode: (text: string) => new Uint32Array(Array.from(text).map((_, i) => i)),
    decode: (tokens: Uint32Array) => {
      // Map token IDs back to ASCII bytes (works for our test strings)
      const bytes = new Uint8Array(tokens.length)
      for (let i = 0; i < tokens.length; i++) bytes[i] = (tokens[i] % 128) + 32
      return bytes
    },
    free: jest.fn(),
  }
  return { get_encoding: jest.fn(() => enc) }
})

// ── Mock OpenAI client ────────────────────────────────────────────────────────
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockImplementation(({ input }: { input: string[] }) => ({
        data: input.map(() => ({ embedding: new Array(1536).fill(0) })),
      })),
    },
  }))
})

import { chunkDocument } from '@/lib/rag/ingest'
import { embedChunks } from '@/lib/openai/embeddings'

// ── chunkDocument ─────────────────────────────────────────────────────────────

describe('chunkDocument', () => {
  it('returns empty array for empty string', () => {
    expect(chunkDocument('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(chunkDocument('   \n\t  ')).toEqual([])
  })

  it('produces correct number of chunks for known-length text', () => {
    // 1000 chars ≈ 1000 tokens (mock: 1 char = 1 token)
    // stride = chunkSize - overlap = 512 - 50 = 462
    // chunk starts: 0, 462, 924 → chunk at 924 has 1000-924 = 76 tokens (≥ 50, included)
    const text = 'a'.repeat(1000)
    const chunks = chunkDocument(text)
    expect(chunks.length).toBe(3)
  })

  it('assigns sequential chunkIndex values starting at 0', () => {
    const text = 'a'.repeat(1000)
    const chunks = chunkDocument(text)
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i))
  })

  it('discards trailing chunks shorter than 50 tokens', () => {
    // 520 tokens → stride=462, starts: 0 (512 tokens), 462 (58 tokens ≥ 50 → included)
    // Next start would be 924, but 520-924 < 0, loop ends.
    // Actually: start=0 → slice 0..512 → 512 tokens ✓
    //           start=462 → slice 462..974, but text only has 520 → 58 tokens ✓
    //           start=924 → slice 924..1436, 520-924 < 0 → loop exits
    const text = 'a'.repeat(520)
    const chunks = chunkDocument(text)
    expect(chunks.length).toBe(2)
    chunks.forEach((c) => expect(c.tokenCount).toBeGreaterThanOrEqual(50))
  })

  it('discards a final chunk with fewer than 50 tokens', () => {
    // 513 tokens → stride=462: start=0 → 512 ✓; start=462 → 51 tokens ✓
    // 514 tokens → start=462 → 52 tokens ✓
    // 511 tokens → start=0 → 511 ✓; start=462 → 49 tokens → discarded
    const text = 'a'.repeat(511)
    const chunks = chunkDocument(text)
    expect(chunks.length).toBe(1)
    expect(chunks[0].tokenCount).toBe(511)
  })

  it('reports correct tokenCount for each chunk', () => {
    const text = 'a'.repeat(1000)
    const chunks = chunkDocument(text)
    // First two chunks should be full-size (512), last may be smaller
    expect(chunks[0].tokenCount).toBe(512)
    expect(chunks[1].tokenCount).toBe(512)
  })

  it('overlap: last 50 tokens of chunk N equal first 50 tokens of chunk N+1', () => {
    const text = 'a'.repeat(1000)
    const chunks = chunkDocument(text)
    expect(chunks.length).toBeGreaterThan(1)

    for (let i = 0; i < chunks.length - 1; i++) {
      const tailOfCurrent = chunks[i].text.slice(-50)
      const headOfNext = chunks[i + 1].text.slice(0, 50)
      expect(tailOfCurrent).toBe(headOfNext)
    }
  })

  it('handles text shorter than chunkSize as a single chunk', () => {
    const text = 'a'.repeat(100)
    const chunks = chunkDocument(text)
    expect(chunks.length).toBe(1)
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[0].tokenCount).toBe(100)
  })

  it('accepts custom chunkSize and overlap', () => {
    // 200 tokens, chunkSize=100, overlap=10, stride=90
    // starts: 0, 90, 180 → slice at 180 has 20 tokens < 50 → discarded
    const text = 'a'.repeat(200)
    const chunks = chunkDocument(text, { chunkSize: 100, overlap: 10 })
    expect(chunks.length).toBe(2)
  })
})

// ── embedChunks ───────────────────────────────────────────────────────────────

describe('embedChunks', () => {
  it('returns embedding arrays of length 1536', async () => {
    const chunks = [
      { text: 'hello', tokenCount: 1, chunkIndex: 0 },
      { text: 'world', tokenCount: 1, chunkIndex: 1 },
    ]
    const result = await embedChunks(chunks)
    expect(result).toHaveLength(2)
    result.forEach((r) => {
      expect(r.embedding).toHaveLength(1536)
    })
  })

  it('preserves all original chunk fields', async () => {
    const chunks = [{ text: 'test', tokenCount: 4, chunkIndex: 0 }]
    const result = await embedChunks(chunks)
    expect(result[0].text).toBe('test')
    expect(result[0].tokenCount).toBe(4)
    expect(result[0].chunkIndex).toBe(0)
  })

  it('returns empty array for empty input', async () => {
    const result = await embedChunks([])
    expect(result).toEqual([])
  })
})
