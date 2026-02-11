-- match_chunks: SECURITY DEFINER (runs as postgres, bypasses RLS).
-- Explicit workspace_id filter enforces tenant isolation in the function body.
-- Called ONLY from the API routes using the service role key.

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding  vector(1536),
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
SET search_path = public
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
