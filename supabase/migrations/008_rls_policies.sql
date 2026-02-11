-- Security-definer helpers in private schema.
-- These are STABLE SECURITY DEFINER functions; PostgreSQL's planner caches them
-- per statement so they do not execute once per row.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.get_my_workspace_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(workspace_id)
  FROM public.memberships
  WHERE user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.my_role_in_workspace(ws_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.memberships
  WHERE workspace_id = ws_id AND user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

-- WORKSPACES
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspaces_select_member" ON public.workspaces FOR SELECT TO authenticated
  USING (id = ANY(private.get_my_workspace_ids()));
CREATE POLICY "workspaces_insert_auth" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "workspaces_update_admin" ON public.workspaces FOR UPDATE TO authenticated
  USING ((SELECT private.my_role_in_workspace(id)) = 'admin');

-- MEMBERSHIPS
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_select_same_workspace" ON public.memberships FOR SELECT TO authenticated
  USING (workspace_id = ANY(private.get_my_workspace_ids()));
CREATE POLICY "memberships_insert_admin" ON public.memberships FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.my_role_in_workspace(workspace_id)) = 'admin');
CREATE POLICY "memberships_delete_admin" ON public.memberships FOR DELETE TO authenticated
  USING ((SELECT private.my_role_in_workspace(workspace_id)) = 'admin');

-- COLLECTIONS
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections_select_member" ON public.collections FOR SELECT TO authenticated
  USING (workspace_id = ANY(private.get_my_workspace_ids()));
CREATE POLICY "collections_write_admin_agent" ON public.collections FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.my_role_in_workspace(workspace_id)) IN ('admin', 'agent'));
CREATE POLICY "collections_update_admin_agent" ON public.collections FOR UPDATE TO authenticated
  USING ((SELECT private.my_role_in_workspace(workspace_id)) IN ('admin', 'agent'));
CREATE POLICY "collections_delete_admin" ON public.collections FOR DELETE TO authenticated
  USING ((SELECT private.my_role_in_workspace(workspace_id)) = 'admin');

-- DOCUMENTS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_select_member" ON public.documents FOR SELECT TO authenticated
  USING (workspace_id = ANY(private.get_my_workspace_ids()));
CREATE POLICY "documents_insert_admin_agent" ON public.documents FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.my_role_in_workspace(workspace_id)) IN ('admin', 'agent'));
CREATE POLICY "documents_delete_admin" ON public.documents FOR DELETE TO authenticated
  USING ((SELECT private.my_role_in_workspace(workspace_id)) = 'admin');

-- DOCUMENT_CHUNKS: No INSERT policy for 'authenticated' — service role only
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chunks_select_member" ON public.document_chunks FOR SELECT TO authenticated
  USING (workspace_id = ANY(private.get_my_workspace_ids()));

-- CHAT_THREADS
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads_select_own" ON public.chat_threads FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND workspace_id = ANY(private.get_my_workspace_ids()));
CREATE POLICY "threads_insert_member" ON public.chat_threads FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND workspace_id = ANY(private.get_my_workspace_ids()));

-- CHAT_MESSAGES: Inserts via service role only
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_thread_owner" ON public.chat_messages FOR SELECT TO authenticated
  USING (thread_id IN (SELECT id FROM public.chat_threads WHERE user_id = (SELECT auth.uid())));

-- CHAT_FEEDBACK
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_select_own" ON public.chat_feedback FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "feedback_insert_own" ON public.chat_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- TICKETS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_select_member" ON public.tickets FOR SELECT TO authenticated
  USING (workspace_id = ANY(private.get_my_workspace_ids()));
CREATE POLICY "tickets_insert_member" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (workspace_id = ANY(private.get_my_workspace_ids()));
CREATE POLICY "tickets_update_agent_admin" ON public.tickets FOR UPDATE TO authenticated
  USING ((SELECT private.my_role_in_workspace(workspace_id)) IN ('admin', 'agent'));

-- TICKET_MESSAGES
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_messages_select_member" ON public.ticket_messages FOR SELECT TO authenticated
  USING (ticket_id IN (SELECT id FROM public.tickets WHERE workspace_id = ANY(private.get_my_workspace_ids())));
CREATE POLICY "ticket_messages_insert_member" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = (SELECT auth.uid()));

-- MISSING_KB_ENTRIES
ALTER TABLE public.missing_kb_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missing_kb_select_admin_agent" ON public.missing_kb_entries FOR SELECT TO authenticated
  USING (workspace_id = ANY(private.get_my_workspace_ids()) AND
    (SELECT private.my_role_in_workspace(workspace_id)) IN ('admin', 'agent'));

-- EVAL TABLES
ALTER TABLE public.eval_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eval_sets_select_admin" ON public.eval_sets FOR SELECT TO authenticated
  USING (workspace_id = ANY(private.get_my_workspace_ids()));
CREATE POLICY "eval_sets_write_admin" ON public.eval_sets FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.my_role_in_workspace(workspace_id)) = 'admin');
CREATE POLICY "eval_cases_select" ON public.eval_cases FOR SELECT TO authenticated
  USING (eval_set_id IN (SELECT id FROM public.eval_sets WHERE workspace_id = ANY(private.get_my_workspace_ids())));
CREATE POLICY "eval_runs_select" ON public.eval_runs FOR SELECT TO authenticated
  USING (eval_set_id IN (
    SELECT id FROM public.eval_sets
    WHERE workspace_id = ANY(private.get_my_workspace_ids())
  ));
CREATE POLICY "eval_runs_insert_admin" ON public.eval_runs FOR INSERT TO authenticated
  WITH CHECK (eval_set_id IN (
    SELECT id FROM public.eval_sets
    WHERE (SELECT private.my_role_in_workspace(workspace_id)) = 'admin'
  ));
