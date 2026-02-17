import { get_encoding } from 'tiktoken'

export interface Chunk {
  text: string
  tokenCount: number
  chunkIndex: number
}

const MIN_CHUNK_TOKENS = 50

/**
 * Splits `text` into overlapping token-window chunks using the cl100k_base
 * encoding (same tokenizer as OpenAI GPT-4 / text-embedding-3-small).
 *
 * How sliding-window overlap works:
 *   - Each chunk starts at position: i * (chunkSize - overlap)
 *   - Each chunk ends at:           start + chunkSize
 *   - Result: the last `overlap` tokens of chunk N are the first `overlap`
 *     tokens of chunk N+1. This ensures retrieval near chunk boundaries
 *     still captures cross-boundary context.
 *
 * Trailing chunks with fewer than MIN_CHUNK_TOKENS (50) tokens are discarded
 * to avoid embedding near-empty strings.
 *
 * @param text      Raw document text (already extracted from PDF or TXT)
 * @param options   chunkSize (default 512) and overlap (default 50)
 * @returns         Array of Chunk objects with decoded text, tokenCount, and index
 */
export function chunkDocument(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {}
): Chunk[] {
  const chunkSize = options.chunkSize ?? 512
  const overlap = options.overlap ?? 50

  if (!text || text.trim().length === 0) return []

  const enc = get_encoding('cl100k_base')
  const tokens = enc.encode(text)
  enc.free()

  const chunks: Chunk[] = []
  const stride = chunkSize - overlap

  const enc2 = get_encoding('cl100k_base')
  for (let start = 0; start < tokens.length; start += stride) {
    const tokenSlice = tokens.slice(start, start + chunkSize)
    // Discard trailing chunks that are too short to embed meaningfully
    if (tokenSlice.length < MIN_CHUNK_TOKENS) break
    const decoded = new TextDecoder().decode(enc2.decode(tokenSlice))
    chunks.push({ text: decoded, tokenCount: tokenSlice.length, chunkIndex: chunks.length })
  }
  enc2.free()

  return chunks
}
