-- Move vector extension out of public schema into the extensions schema.
-- Supabase includes 'extensions' in the default search_path so the vector
-- type and <=> operator remain accessible without schema-qualifying them.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
