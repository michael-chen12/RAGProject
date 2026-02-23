-- supabase/seed.sql
-- Demo data for multi-tenant RAG platform
-- IMPORTANT: Auth users must be created manually via Supabase Auth before running this seed

-- ============================
-- HARDCODED USER UUIDs
-- ============================
-- These UUIDs must match the auth.users created manually in Supabase Auth:
-- 1. Admin: demo-admin@acme.com  → 11111111-1111-1111-1111-111111111111
-- 2. Agent: demo-agent@acme.com  → 22222222-2222-2222-2222-222222222222
-- 3. Viewer: demo-viewer@acme.com → 33333333-3333-3333-3333-333333333333

-- ============================
-- 1. PROFILES
-- ============================
INSERT INTO public.profiles (id, email, first_name, last_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo-admin@acme.com', 'Alice', 'Admin'),
  ('22222222-2222-2222-2222-222222222222', 'demo-agent@acme.com', 'Bob', 'Agent'),
  ('33333333-3333-3333-3333-333333333333', 'demo-viewer@acme.com', 'Charlie', 'Viewer');

-- ============================
-- 2. WORKSPACE
-- ============================
INSERT INTO public.workspaces (id, name, slug, created_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corp Demo', 'acme-demo', '11111111-1111-1111-1111-111111111111');

-- ============================
-- 3. MEMBERSHIPS
-- ============================
INSERT INTO public.memberships (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'agent'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'viewer');

-- ============================
-- 4. COLLECTIONS
-- ============================
INSERT INTO public.collections (id, workspace_id, name, visibility) VALUES
  ('cccccccc-1111-1111-1111-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Product Documentation', 'public'),
  ('cccccccc-2222-2222-2222-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Internal Policies', 'private');

-- ============================
-- 5. DOCUMENTS
-- ============================
INSERT INTO public.documents (id, workspace_id, collection_id, user_id, filename, storage_path, status, token_count) VALUES
  ('dddddddd-1111-1111-1111-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'getting-started.md', 'acme-demo/getting-started.md', 'indexed', 1200),
  ('dddddddd-2222-2222-2222-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'api-reference.md', 'acme-demo/api-reference.md', 'indexed', 2400),
  ('dddddddd-3333-3333-3333-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'troubleshooting.md', 'acme-demo/troubleshooting.md', 'indexed', 1800),
  ('dddddddd-4444-4444-4444-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-2222-2222-2222-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'hr-policies.md', 'acme-demo/hr-policies.md', 'indexed', 1500);

-- ============================
-- 6. DOCUMENT CHUNKS with EMBEDDINGS
-- ============================
-- Using normalized placeholder vectors (1536-dim) with distinct patterns per topic
-- Pattern A: Getting Started content (0.001 base value)
-- Pattern B: API Reference content (0.002 base value)
-- Pattern C: Troubleshooting content (0.003 base value)
-- Pattern D: HR Policies content (0.004 base value)

-- Helper function to generate normalized placeholder embeddings
CREATE OR REPLACE FUNCTION generate_placeholder_embedding(base_val float)
RETURNS vector AS $$
DECLARE
  arr float[];
  i int;
  norm float := 0;
  result vector;
BEGIN
  arr := ARRAY[]::float[];

  -- Generate 1536 values
  FOR i IN 1..1536 LOOP
    arr := array_append(arr, base_val + (random() * 0.0001)::float);
  END LOOP;

  -- Calculate L2 norm
  FOR i IN 1..1536 LOOP
    norm := norm + (arr[i] * arr[i]);
  END LOOP;
  norm := sqrt(norm);

  -- Normalize
  FOR i IN 1..1536 LOOP
    arr[i] := arr[i] / norm;
  END LOOP;

  -- Convert to vector
  result := arr::vector;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Getting Started chunks (Pattern A)
INSERT INTO public.document_chunks (document_id, workspace_id, collection_id, chunk_text, embedding, token_count, chunk_index) VALUES
  ('dddddddd-1111-1111-1111-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Welcome to Acme Corp! This guide will help you get started with our platform. First, create an account by visiting our signup page and entering your email address. You will receive a confirmation email within minutes.',
   generate_placeholder_embedding(0.001), 150, 0),

  ('dddddddd-1111-1111-1111-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'After verifying your email, log in to your account and complete your profile. Add your name, company information, and preferences. This helps us personalize your experience.',
   generate_placeholder_embedding(0.001), 140, 1),

  ('dddddddd-1111-1111-1111-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'To create your first workspace, navigate to the Workspaces section and click "New Workspace". Enter a name and optional description. Workspaces help you organize your documents and collaborate with team members.',
   generate_placeholder_embedding(0.001), 160, 2),

  ('dddddddd-1111-1111-1111-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Upload your first document by dragging and dropping files into the document area, or click the upload button. Supported formats include PDF, TXT, MD, and DOCX. Files are processed automatically and indexed for search.',
   generate_placeholder_embedding(0.001), 170, 3),

  ('dddddddd-1111-1111-1111-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Invite team members by going to Settings > Members and entering their email addresses. You can assign roles: Admin (full access), Agent (can manage content and support), or Viewer (read-only access).',
   generate_placeholder_embedding(0.001), 155, 4);

-- API Reference chunks (Pattern B)
INSERT INTO public.document_chunks (document_id, workspace_id, collection_id, chunk_text, embedding, token_count, chunk_index) VALUES
  ('dddddddd-2222-2222-2222-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'API Authentication: All API requests must include an Authorization header with your API key. Example: Authorization: Bearer sk_live_xxxxxxxxxxxx. API keys can be generated in your account settings.',
   generate_placeholder_embedding(0.002), 180, 0),

  ('dddddddd-2222-2222-2222-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'POST /api/chat - Send a chat message and receive an AI-generated response with citations. Request body: {query: string, workspaceId: string, threadId?: string}. Response includes answer text and source citations.',
   generate_placeholder_embedding(0.002), 190, 1),

  ('dddddddd-2222-2222-2222-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'GET /api/documents - List all documents in a workspace. Query parameters: workspaceId (required), collectionId (optional), status (optional: processing, indexed, failed). Returns paginated results with document metadata.',
   generate_placeholder_embedding(0.002), 175, 2),

  ('dddddddd-2222-2222-2222-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'POST /api/documents/upload - Upload a new document for indexing. Use multipart/form-data with fields: file (required), workspaceId (required), collectionId (optional). Returns document ID and processing status.',
   generate_placeholder_embedding(0.002), 185, 3),

  ('dddddddd-2222-2222-2222-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Rate Limits: API requests are limited to 100 requests per minute per API key. If you exceed this limit, you will receive a 429 Too Many Requests error. Upgrade to Enterprise for higher limits.',
   generate_placeholder_embedding(0.002), 165, 4),

  ('dddddddd-2222-2222-2222-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Error Handling: All errors return standard HTTP status codes. 400 for bad requests, 401 for authentication errors, 403 for permission denied, 404 for not found, and 500 for server errors. Error responses include a message field with details.',
   generate_placeholder_embedding(0.002), 195, 5);

-- Troubleshooting chunks (Pattern C)
INSERT INTO public.document_chunks (document_id, workspace_id, collection_id, chunk_text, embedding, token_count, chunk_index) VALUES
  ('dddddddd-3333-3333-3333-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Problem: Document upload fails with "Processing error". Solution: Check that your file format is supported (PDF, TXT, MD, DOCX). Ensure the file size is under 50MB. If the problem persists, contact support with the document ID.',
   generate_placeholder_embedding(0.003), 200, 0),

  ('dddddddd-3333-3333-3333-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Problem: Chat responses are slow or timing out. Solution: This usually happens during high traffic periods. Try refreshing the page and sending your question again. Check our status page at status.acme.com for system updates.',
   generate_placeholder_embedding(0.003), 185, 1),

  ('dddddddd-3333-3333-3333-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Problem: Cannot invite team members. Solution: Verify you have Admin role in the workspace. Check that email addresses are correctly formatted. Free plans are limited to 5 members; upgrade to add more users.',
   generate_placeholder_embedding(0.003), 170, 2),

  ('dddddddd-3333-3333-3333-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Problem: Search results are not relevant. Solution: Documents must be fully indexed before appearing in search results. Check document status in the Documents page. Re-upload documents that show "failed" status.',
   generate_placeholder_embedding(0.003), 165, 3),

  ('dddddddd-3333-3333-3333-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-cccccccccccc',
   'Problem: API returns 401 Unauthorized. Solution: Verify your API key is correct and active. Check that the Authorization header is properly formatted: "Bearer YOUR_KEY". Generate a new API key if needed.',
   generate_placeholder_embedding(0.003), 175, 4);

-- HR Policies chunks (Pattern D - Private collection)
INSERT INTO public.document_chunks (document_id, workspace_id, collection_id, chunk_text, embedding, token_count, chunk_index) VALUES
  ('dddddddd-4444-4444-4444-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-2222-2222-2222-cccccccccccc',
   'Vacation Policy: All full-time employees receive 15 days of paid vacation per year, accruing monthly. Vacation requests must be submitted at least 2 weeks in advance for approval. Unused vacation days do not roll over to the next year.',
   generate_placeholder_embedding(0.004), 180, 0),

  ('dddddddd-4444-4444-4444-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-2222-2222-2222-cccccccccccc',
   'Remote Work Policy: Employees may work remotely up to 3 days per week with manager approval. Remote workers must be available during core hours (10 AM - 3 PM local time) and maintain regular communication with their team.',
   generate_placeholder_embedding(0.004), 175, 1),

  ('dddddddd-4444-4444-4444-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-2222-2222-2222-cccccccccccc',
   'Equipment Policy: The company provides a laptop and necessary software licenses. Employees are responsible for equipment care and must return all company property upon termination. Personal use of company equipment is permitted within reason.',
   generate_placeholder_embedding(0.004), 170, 2),

  ('dddddddd-4444-4444-4444-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-2222-2222-2222-cccccccccccc',
   'Professional Development: Employees receive $1000 annually for conferences, courses, or certifications related to their role. Requests must be approved in advance by your manager and HR.',
   generate_placeholder_embedding(0.004), 160, 3);

-- Drop the helper function
DROP FUNCTION generate_placeholder_embedding(float);

-- ============================
-- 7. TICKETS
-- ============================
INSERT INTO public.tickets (id, workspace_id, title, status, assigned_agent_id) VALUES
  ('tttttttt-1111-1111-1111-tttttttttttt', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Unable to upload large PDF files', 'open', NULL),
  ('tttttttt-2222-2222-2222-tttttttttttt', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'API key not working after regeneration', 'pending', '22222222-2222-2222-2222-222222222222'),
  ('tttttttt-3333-3333-3333-tttttttttttt', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Search results missing recent documents', 'pending', '22222222-2222-2222-2222-222222222222'),
  ('tttttttt-4444-4444-4444-tttttttttttt', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Question about workspace member limits', 'resolved', '22222222-2222-2222-2222-222222222222'),
  ('tttttttt-5555-5555-5555-tttttttttttt', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'How to export chat history?', 'resolved', '22222222-2222-2222-2222-222222222222');

-- ============================
-- 8. TICKET MESSAGES
-- ============================
INSERT INTO public.ticket_messages (ticket_id, author_id, content) VALUES
  -- Ticket 1: Unable to upload large PDF files
  ('tttttttt-1111-1111-1111-tttttttttttt', '33333333-3333-3333-3333-333333333333', 'I am trying to upload a 45MB PDF file but keep getting an error message saying "Upload failed". The file is a product manual in PDF format.'),

  -- Ticket 2: API key not working
  ('tttttttt-2222-2222-2222-tttttttttttt', '33333333-3333-3333-3333-333333333333', 'I regenerated my API key yesterday and now all my API calls are returning 401 errors. The key looks correct in my code.'),
  ('tttttttt-2222-2222-2222-tttttttttttt', '22222222-2222-2222-2222-222222222222', 'Thanks for reporting this. Can you confirm you are using the new key and that it starts with "sk_live_"? Also, please check that there are no extra spaces when copying the key.'),
  ('tttttttt-2222-2222-2222-tttttttttttt', '33333333-3333-3333-3333-333333333333', 'Yes, confirmed it starts with sk_live_ and I triple-checked for spaces. Still getting 401 errors.'),

  -- Ticket 3: Search results missing
  ('tttttttt-3333-3333-3333-tttttttttttt', '33333333-3333-3333-3333-333333333333', 'I uploaded 3 documents this morning but they are not appearing in search results. The documents show "indexed" status in the Documents page.'),
  ('tttttttt-3333-3333-3333-tttttttttttt', '22222222-2222-2222-2222-222222222222', 'I will investigate this issue. Can you provide the document IDs or filenames?'),

  -- Ticket 4: Workspace member limits (RESOLVED)
  ('tttttttt-4444-4444-4444-tttttttttttt', '33333333-3333-3333-3333-333333333333', 'What is the limit on workspace members for the free plan? We want to add 2 more people.'),
  ('tttttttt-4444-4444-4444-tttttttttttt', '22222222-2222-2222-2222-222222222222', 'The free plan supports up to 5 members per workspace. Your workspace currently has 3 members, so you can add 2 more without upgrading. Let me know if you need help with invitations!'),
  ('tttttttt-4444-4444-4444-tttttttttttt', '33333333-3333-3333-3333-333333333333', 'Perfect, thank you! That answers my question.'),

  -- Ticket 5: Export chat history (RESOLVED)
  ('tttttttt-5555-5555-5555-tttttttttttt', '33333333-3333-3333-3333-333333333333', 'Is there a way to export or download my chat history? I need to save some important conversations.'),
  ('tttttttt-5555-5555-5555-tttttttttttt', '22222222-2222-2222-2222-222222222222', 'Currently, you can copy individual messages manually. We are working on a bulk export feature for a future release. As a workaround, you can use the browser''s print-to-PDF function on the chat page.'),
  ('tttttttt-5555-5555-5555-tttttttttttt', '33333333-3333-3333-3333-333333333333', 'Thanks! The print-to-PDF workaround works for now.');

-- ============================
-- 9. EVAL SETS & CASES
-- ============================
INSERT INTO public.eval_sets (id, workspace_id, name) VALUES
  ('eeeeeeee-1111-1111-1111-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Product Knowledge Evaluation'),
  ('eeeeeeee-2222-2222-2222-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'API Documentation Evaluation');

-- Product Knowledge eval cases
INSERT INTO public.eval_cases (eval_set_id, question, expected_answer, expected_source_ids) VALUES
  ('eeeeeeee-1111-1111-1111-eeeeeeeeeeee',
   'How do I create a new workspace?',
   'Navigate to the Workspaces section and click "New Workspace". Enter a name and optional description.',
   '["Chunk IDs will vary - this is a placeholder for demonstration"]'),

  ('eeeeeeee-1111-1111-1111-eeeeeeeeeeee',
   'What file formats are supported for document upload?',
   'Supported formats include PDF, TXT, MD, and DOCX.',
   '["Chunk IDs will vary"]'),

  ('eeeeeeee-1111-1111-1111-eeeeeeeeeeee',
   'How do I invite team members to my workspace?',
   'Go to Settings > Members and enter their email addresses. You can assign roles: Admin, Agent, or Viewer.',
   '["Chunk IDs will vary"]'),

  ('eeeeeeee-1111-1111-1111-eeeeeeeeeeee',
   'What should I do if document upload fails?',
   'Check that your file format is supported and file size is under 50MB. If the problem persists, contact support with the document ID.',
   '["Chunk IDs will vary"]'),

  ('eeeeeeee-1111-1111-1111-eeeeeeeeeeee',
   'Why are my search results not showing recent documents?',
   'Documents must be fully indexed before appearing in search results. Check document status in the Documents page.',
   '["Chunk IDs will vary"]');

-- API Documentation eval cases
INSERT INTO public.eval_cases (eval_set_id, question, expected_answer, expected_source_ids) VALUES
  ('eeeeeeee-2222-2222-2222-eeeeeeeeeeee',
   'How do I authenticate API requests?',
   'Include an Authorization header with your API key: Authorization: Bearer sk_live_xxxxxxxxxxxx',
   '["Chunk IDs will vary"]'),

  ('eeeeeeee-2222-2222-2222-eeeeeeeeeeee',
   'What is the endpoint for uploading documents?',
   'POST /api/documents/upload with multipart/form-data containing file, workspaceId, and optional collectionId.',
   '["Chunk IDs will vary"]'),

  ('eeeeeeee-2222-2222-2222-eeeeeeeeeeee',
   'What are the API rate limits?',
   'API requests are limited to 100 requests per minute per API key. Exceeding this returns a 429 error.',
   '["Chunk IDs will vary"]'),

  ('eeeeeeee-2222-2222-2222-eeeeeeeeeeee',
   'How do I list documents in a workspace?',
   'Use GET /api/documents with required workspaceId query parameter and optional collectionId and status filters.',
   '["Chunk IDs will vary"]'),

  ('eeeeeeee-2222-2222-2222-eeeeeeeeeeee',
   'What error codes does the API return?',
   'Standard HTTP codes: 400 for bad requests, 401 for auth errors, 403 for permission denied, 404 for not found, 500 for server errors.',
   '["Chunk IDs will vary"]');

-- ============================
-- VERIFICATION QUERIES
-- ============================
-- Run these to verify seed data:
-- SELECT COUNT(*) FROM public.profiles;           -- Expected: 3
-- SELECT COUNT(*) FROM public.workspaces;         -- Expected: 1
-- SELECT COUNT(*) FROM public.memberships;        -- Expected: 3
-- SELECT COUNT(*) FROM public.collections;        -- Expected: 2
-- SELECT COUNT(*) FROM public.documents;          -- Expected: 4
-- SELECT COUNT(*) FROM public.document_chunks;    -- Expected: 24
-- SELECT COUNT(*) FROM public.tickets;            -- Expected: 5
-- SELECT COUNT(*) FROM public.ticket_messages;    -- Expected: 13
-- SELECT COUNT(*) FROM public.eval_sets;          -- Expected: 2
-- SELECT COUNT(*) FROM public.eval_cases;         -- Expected: 10
