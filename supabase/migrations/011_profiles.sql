-- supabase/migrations/011_profiles.sql
-- Profiles table to store user information linked to auth.users

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can view profiles of workspace members (for displaying member lists)
CREATE POLICY "Users can view workspace member profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m1
      JOIN memberships m2 ON m1.workspace_id = m2.workspace_id
      WHERE m1.user_id = auth.uid()
      AND m2.user_id = profiles.id
    )
  );

-- Index for email lookups (used by invitation conversion)
CREATE INDEX idx_profiles_email ON profiles(email);
