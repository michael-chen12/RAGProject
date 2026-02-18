-- supabase/migrations/012_invitations.sql
-- Invitations table for pending workspace invites with security features

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role member_role NOT NULL DEFAULT 'viewer',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token UUID DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  reminder_sent_at TIMESTAMPTZ,
  invite_count INTEGER DEFAULT 1,
  last_sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, email)
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view workspace invitations
CREATE POLICY "Admins can view workspace invitations"
  ON invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.workspace_id = invitations.workspace_id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'admin'
    )
  );

-- Admins can insert workspace invitations
CREATE POLICY "Admins can insert workspace invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.workspace_id = invitations.workspace_id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'admin'
    )
  );

-- Admins can update workspace invitations (for resend tracking)
CREATE POLICY "Admins can update workspace invitations"
  ON invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.workspace_id = invitations.workspace_id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'admin'
    )
  );

-- Admins can delete workspace invitations
CREATE POLICY "Admins can delete workspace invitations"
  ON invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.workspace_id = invitations.workspace_id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_invitations_workspace ON invitations(workspace_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_expires ON invitations(expires_at);
