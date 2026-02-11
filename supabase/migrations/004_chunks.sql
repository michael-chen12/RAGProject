CREATE TABLE public.document_chunks (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id    uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workspace_id   uuid NOT NULL,        -- denormalized for RLS + vector search
  collection_id  uuid,                 -- denormalized for filtering
  chunk_text     text NOT NULL,
  embedding      vector(1536),         -- text-embedding-3-small
  token_count    integer,
  chunk_index    integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- IVFFlat approximate nearest-neighbor. lists = sqrt(expected rows). Start at 100.
CREATE INDEX document_chunks_embedding_idx
  ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX document_chunks_workspace_idx   ON public.document_chunks (workspace_id);
CREATE INDEX document_chunks_collection_idx  ON public.document_chunks (collection_id);
CREATE INDEX document_chunks_document_idx    ON public.document_chunks (document_id);
