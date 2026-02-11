CREATE TABLE public.chat_threads (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL DEFAULT 'New chat',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.chat_role AS ENUM ('user', 'assistant');

CREATE TABLE public.chat_messages (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id   uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  role        public.chat_role NOT NULL,
  content     text NOT NULL,
  citations   jsonb,        -- [{ index, chunkId, documentId, filename, snippet, similarity }]
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_feedback (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id  uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      text NOT NULL CHECK (rating IN ('up', 'down')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX chat_threads_workspace_idx ON public.chat_threads (workspace_id);
CREATE INDEX chat_threads_user_idx      ON public.chat_threads (user_id);
CREATE INDEX chat_messages_thread_idx   ON public.chat_messages (thread_id);
