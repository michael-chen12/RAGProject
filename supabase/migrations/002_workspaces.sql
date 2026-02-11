CREATE TABLE public.workspaces (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.member_role AS ENUM ('admin', 'agent', 'viewer');

CREATE TABLE public.memberships (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          public.member_role NOT NULL DEFAULT 'viewer',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX memberships_user_id_idx   ON public.memberships (user_id);
CREATE INDEX memberships_workspace_idx ON public.memberships (workspace_id);
