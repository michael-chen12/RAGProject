#!/usr/bin/env npx tsx

/**
 * Embedding Migration Script
 *
 * Re-embeds all documents in the database using the currently configured AI provider.
 * Use this script after switching embedding providers (e.g., OpenAI → Together.ai).
 *
 * Prerequisites:
 * 1. Run the database migration first: supabase migration up
 * 2. Set the correct AI provider env vars in .env.local
 *
 * Usage:
 *   npx tsx scripts/migrate-embeddings.ts
 *
 * Options:
 *   --workspace-id <uuid>   Only migrate documents in a specific workspace
 *   --document-id <uuid>    Only migrate a specific document
 *   --dry-run               Show what would be migrated without making changes
 *   --batch-size <n>        Number of documents to process per batch (default: 10)
 */

import { createClient } from '@supabase/supabase-js'
import { chunkDocument } from '../src/lib/rag/ingest'
import { embedChunks, EMBEDDING_DIMENSIONS } from '../src/lib/gemini'

// Load environment variables
import 'dotenv/config'

const CHUNK_INSERT_BATCH = 500

interface MigrationOptions {
  workspaceId?: string
  documentId?: string
  dryRun: boolean
  batchSize: number
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2)
  const options: MigrationOptions = {
    dryRun: false,
    batchSize: 10,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--workspace-id':
        options.workspaceId = args[++i]
        break
      case '--document-id':
        options.documentId = args[++i]
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10)
        break
      case '--help':
        console.log(`
Embedding Migration Script

Re-embeds all documents using the currently configured AI provider.

Usage:
  npx tsx scripts/migrate-embeddings.ts [options]

Options:
  --workspace-id <uuid>   Only migrate documents in a specific workspace
  --document-id <uuid>    Only migrate a specific document
  --dry-run               Show what would be migrated without making changes
  --batch-size <n>        Number of documents to process per batch (default: 10)
  --help                  Show this help message
        `)
        process.exit(0)
    }
  }

  return options
}

async function downloadAndParseDocument(
  supabase: ReturnType<typeof createClient>,
  doc: { id: string; filename: string; storage_path: string }
): Promise<string> {
  const { data: fileData, error } = await supabase.storage
    .from('documents')
    .download(doc.storage_path)

  if (error || !fileData) {
    throw new Error(`Failed to download ${doc.filename}: ${error?.message}`)
  }

  const isPdf = doc.filename.toLowerCase().endsWith('.pdf')

  if (isPdf) {
    // Dynamic import for pdf-parse
    const { PDFParse } = await import('pdf-parse')
    const arrayBuffer = await fileData.arrayBuffer()
    const parser = new PDFParse({ data: new Uint8Array(arrayBuffer), verbosity: 0 })
    const result = await parser.getText()
    return result.text
  } else {
    return await fileData.text()
  }
}

async function migrateDocument(
  supabase: ReturnType<typeof createClient>,
  doc: { id: string; filename: string; storage_path: string; workspace_id: string; collection_id: string | null },
  dryRun: boolean
): Promise<{ chunkCount: number; tokenCount: number }> {
  console.log(`  Processing: ${doc.filename} (${doc.id})`)

  // 1. Download and parse the document
  const text = await downloadAndParseDocument(supabase, doc)

  if (!text || text.trim().length === 0) {
    throw new Error('Extracted text is empty')
  }

  // 2. Chunk the document
  const chunks = chunkDocument(text)

  if (chunks.length === 0) {
    throw new Error('Document produced no chunks')
  }

  console.log(`    Chunks: ${chunks.length}`)

  if (dryRun) {
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0)
    return { chunkCount: chunks.length, tokenCount: totalTokens }
  }

  // 3. Delete existing chunks for this document
  const { error: deleteError } = await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', doc.id)

  if (deleteError) {
    throw new Error(`Failed to delete old chunks: ${deleteError.message}`)
  }

  // 4. Embed all chunks
  console.log(`    Embedding ${chunks.length} chunks...`)
  const embeddedChunks = await embedChunks(chunks)

  // 5. Insert new chunks
  console.log(`    Inserting chunks...`)
  for (let i = 0; i < embeddedChunks.length; i += CHUNK_INSERT_BATCH) {
    const batch = embeddedChunks.slice(i, i + CHUNK_INSERT_BATCH)
    const rows = batch.map((c) => ({
      document_id: doc.id,
      workspace_id: doc.workspace_id,
      collection_id: doc.collection_id,
      chunk_text: c.text,
      embedding: JSON.stringify(c.embedding),
      token_count: c.tokenCount,
      chunk_index: c.chunkIndex,
    }))

    const { error: insertError } = await supabase.from('document_chunks').insert(rows)
    if (insertError) {
      throw new Error(`Chunk insert failed: ${insertError.message}`)
    }
  }

  // 6. Update document token count
  const totalTokens = embeddedChunks.reduce((sum, c) => sum + c.tokenCount, 0)
  await supabase
    .from('documents')
    .update({ token_count: totalTokens, status: 'indexed' })
    .eq('id', doc.id)

  console.log(`    Done: ${embeddedChunks.length} chunks, ${totalTokens} tokens`)
  return { chunkCount: embeddedChunks.length, tokenCount: totalTokens }
}

async function main() {
  const options = parseArgs()

  // Validate environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    console.error('Make sure you have a .env.local file with these variables.')
    process.exit(1)
  }

  // Show current configuration
  const provider = 'gemini'
  const dimensions = EMBEDDING_DIMENSIONS

  console.log('\n=== Embedding Migration ===')
  console.log(`Provider: ${provider}`)
  console.log(`Dimensions: ${dimensions}`)
  console.log(`Dry run: ${options.dryRun}`)
  console.log('')

  if (options.dryRun) {
    console.log('*** DRY RUN - No changes will be made ***\n')
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Build query for documents
  let query = supabase
    .from('documents')
    .select('id, filename, storage_path, workspace_id, collection_id, status')
    .eq('status', 'indexed') // Only migrate already-indexed documents
    .order('created_at', { ascending: true })

  if (options.documentId) {
    query = query.eq('id', options.documentId)
  } else if (options.workspaceId) {
    query = query.eq('workspace_id', options.workspaceId)
  }

  const { data: documents, error: queryError } = await query

  if (queryError) {
    console.error('Error fetching documents:', queryError.message)
    process.exit(1)
  }

  if (!documents || documents.length === 0) {
    console.log('No documents found to migrate.')
    process.exit(0)
  }

  console.log(`Found ${documents.length} document(s) to migrate.\n`)

  // Process documents in batches
  let totalChunks = 0
  let totalTokens = 0
  let successCount = 0
  let failCount = 0
  const failures: Array<{ id: string; filename: string; error: string }> = []

  for (let i = 0; i < documents.length; i += options.batchSize) {
    const batch = documents.slice(i, i + options.batchSize)
    console.log(`\nBatch ${Math.floor(i / options.batchSize) + 1}/${Math.ceil(documents.length / options.batchSize)}`)

    for (const doc of batch) {
      try {
        const result = await migrateDocument(supabase, doc, options.dryRun)
        totalChunks += result.chunkCount
        totalTokens += result.tokenCount
        successCount++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`    ERROR: ${message}`)
        failures.push({ id: doc.id, filename: doc.filename, error: message })
        failCount++

        // Mark document as failed (unless dry run)
        if (!options.dryRun) {
          await supabase
            .from('documents')
            .update({ status: 'failed', error_message: `Migration failed: ${message}` })
            .eq('id', doc.id)
        }
      }
    }
  }

  // Summary
  console.log('\n=== Migration Summary ===')
  console.log(`Total documents: ${documents.length}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Total chunks: ${totalChunks}`)
  console.log(`Total tokens: ${totalTokens}`)

  if (failures.length > 0) {
    console.log('\nFailed documents:')
    for (const f of failures) {
      console.log(`  - ${f.filename} (${f.id}): ${f.error}`)
    }
  }

  if (options.dryRun) {
    console.log('\n*** DRY RUN - No changes were made ***')
  }

  process.exit(failCount > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
