-- Migration: Support 768-dim embeddings for Together.ai
--
-- This migration changes the embedding dimension from 1536 (OpenAI) to 768 (Together.ai).
-- IMPORTANT: This will clear all existing embeddings. You must re-ingest documents after running this migration.
--
-- To revert to OpenAI (1536-dim), create a new migration that reverses these changes.

-- Step 1: Drop existing index (required before altering column)
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- Step 2: Drop the existing embedding column
ALTER TABLE public.document_chunks DROP COLUMN IF EXISTS embedding;

-- Step 3: Add new embedding column with 768 dimensions
ALTER TABLE public.document_chunks ADD COLUMN embedding vector(768);

-- Step 4: Recreate the IVFFlat index for approximate nearest-neighbor search
-- Note: This index will be empty until documents are re-ingested
CREATE INDEX document_chunks_embedding_idx
  ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Step 5: Update the match_chunks function to use 768-dim vectors
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding  vector(768),
  workspace_id_arg uuid,
  collection_ids   uuid[],        -- empty array = search all collections
  match_threshold  float DEFAULT 0.75,
  match_count      int   DEFAULT 8
)
RETURNS TABLE (
  id            uuid,
  document_id   uuid,
  collection_id uuid,
  chunk_text    text,
  token_count   integer,
  chunk_index   integer,
  similarity    float
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Set probes at query time for accuracy/speed balance
  PERFORM set_config('ivfflat.probes', '10', true);

  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.collection_id,
    dc.chunk_text,
    dc.token_count,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE
    dc.workspace_id = workspace_id_arg
    AND (
      array_length(collection_ids, 1) IS NULL
      OR dc.collection_id = ANY(collection_ids)
    )
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.match_chunks IS
  'Performs vector similarity search on document chunks using 768-dim embeddings (Together.ai m2-bert-80M-8k-retrieval). ' ||
  'Supports filtering by workspace and collections. Uses SECURITY DEFINER to bypass RLS.';
