import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { createServiceClient } from '@/lib/supabase/server'
import { chunkDocument } from '@/lib/rag/ingest'
import { embedChunks } from '@/lib/openai/embeddings'

type RouteContext = { params: Promise<{ documentId: string }> }

const CHUNK_INSERT_BATCH = 500

/**
 * POST /api/ingest/[documentId]
 *
 * Downloads the file from private Supabase Storage, parses it, chunks and
 * embeds it, then batch-inserts the results into document_chunks.
 *
 * Uses service-role client throughout — there is no authenticated INSERT policy
 * on document_chunks by design. The documentId acts as a capability token.
 *
 * On any error the document status is set to 'failed' with an error_message,
 * and any partial chunks inserted in this run are deleted to avoid orphans.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { documentId } = await params
  const service = createServiceClient()

  // 1. Fetch document record so we know the storage path and workspace
  const { data: doc, error: fetchError } = await service
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    // 2. Download file from private Storage bucket
    const { data: fileData, error: downloadError } = await service.storage
      .from('documents')
      .download(doc.storage_path)

    if (downloadError || !fileData) {
      throw new Error(`Storage download failed: ${downloadError?.message ?? 'unknown'}`)
    }

    // 3. Parse text — pdf-parse for PDFs, UTF-8 decode for TXT
    let text: string
    const isPdf = doc.filename.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      const arrayBuffer = await fileData.arrayBuffer()
      const parser = new PDFParse({ data: new Uint8Array(arrayBuffer), verbosity: 0 })
      const result = await parser.getText()
      text = result.text
    } else {
      text = await fileData.text()
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Extracted text is empty')
    }

    // 4. Chunk the document into overlapping token windows
    const chunks = chunkDocument(text)

    if (chunks.length === 0) {
      throw new Error('Document produced no chunks (too short?)')
    }

    // 5. Embed all chunks in batches of 100
    const embeddedChunks = await embedChunks(chunks)

    // 6. Batch-insert into document_chunks (500 rows per insert to stay well
    //    within Postgres's max-parameter limit of ~65,535)
    for (let i = 0; i < embeddedChunks.length; i += CHUNK_INSERT_BATCH) {
      const batch = embeddedChunks.slice(i, i + CHUNK_INSERT_BATCH)
      const rows = batch.map((c) => ({
        document_id: documentId,
        workspace_id: doc.workspace_id,
        collection_id: doc.collection_id,
        chunk_text: c.text,
        embedding: JSON.stringify(c.embedding), // pgvector accepts JSON array string
        token_count: c.tokenCount,
        chunk_index: c.chunkIndex,
      }))

      const { error: insertError } = await service.from('document_chunks').insert(rows)
      if (insertError) {
        throw new Error(`Chunk insert failed: ${insertError.message}`)
      }
    }

    // 7. Mark document as indexed
    const totalTokens = embeddedChunks.reduce((sum, c) => sum + c.tokenCount, 0)
    await service
      .from('documents')
      .update({ status: 'indexed', token_count: totalTokens })
      .eq('id', documentId)

    return NextResponse.json({ chunkCount: embeddedChunks.length, totalTokens })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Clean up any partial chunks so the document can be retried cleanly
    await service.from('document_chunks').delete().eq('document_id', documentId)

    // Mark document as failed with the error message
    await service
      .from('documents')
      .update({ status: 'failed', error_message: message })
      .eq('id', documentId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
