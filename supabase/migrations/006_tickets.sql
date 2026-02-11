CREATE TYPE public.ticket_status AS ENUM ('open', 'pending', 'resolved');

CREATE TABLE public.tickets (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title              text NOT NULL,
  status             public.ticket_status NOT NULL DEFAULT 'open',
  assigned_agent_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_messages (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.missing_kb_entries (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  question      text NOT NULL,
  context       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tickets_workspace_idx ON public.tickets (workspace_id);
CREATE INDEX tickets_status_idx    ON public.tickets (status);
