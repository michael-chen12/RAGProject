CREATE TYPE public.collection_visibility AS ENUM ('public', 'private');
CREATE TYPE public.doc_status AS ENUM ('processing', 'indexed', 'failed');

CREATE TABLE public.collections (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  visibility    public.collection_visibility NOT NULL DEFAULT 'private',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.documents (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  collection_id   uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  filename        text NOT NULL,
  storage_path    text NOT NULL,
  status          public.doc_status NOT NULL DEFAULT 'processing',
  token_count     integer,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_workspace_idx  ON public.documents (workspace_id);
CREATE INDEX documents_collection_idx ON public.documents (collection_id);
CREATE INDEX documents_status_idx     ON public.documents (status);
