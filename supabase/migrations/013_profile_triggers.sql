-- supabase/migrations/013_profile_triggers.sql
-- Triggers for auto-creating profiles and converting invitations to memberships

-- Trigger function: Create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger function: Convert pending invitations to memberships
CREATE OR REPLACE FUNCTION public.convert_invitations_to_memberships()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert pending invitations for this user's email to memberships
  INSERT INTO public.memberships (workspace_id, user_id, role)
  SELECT workspace_id, NEW.id, role
  FROM public.invitations
  WHERE LOWER(email) = LOWER(NEW.email)
  AND expires_at > now()
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Delete processed invitations
  DELETE FROM public.invitations
  WHERE LOWER(email) = LOWER(NEW.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (runs after handle_new_user)
CREATE TRIGGER on_user_convert_invitations
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.convert_invitations_to_memberships();
