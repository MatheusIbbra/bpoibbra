
-- 1. Fix pending_registrations: restrict access to service_role and own session_token
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "Anyone can insert pending registrations" ON public.pending_registrations;
DROP POLICY IF EXISTS "Anyone can read pending registrations" ON public.pending_registrations;
DROP POLICY IF EXISTS "Anyone can update pending registrations" ON public.pending_registrations;
DROP POLICY IF EXISTS "Anyone can delete pending registrations" ON public.pending_registrations;

-- Only service_role can fully manage
CREATE POLICY "Service role manages pending registrations"
ON public.pending_registrations FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Anon users can insert (for registration flow)
CREATE POLICY "Anon can insert pending registrations"
ON public.pending_registrations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2. Fix bank_connections_safe view - recreate without token columns
DROP VIEW IF EXISTS public.bank_connections_safe;

CREATE VIEW public.bank_connections_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  organization_id,
  user_id,
  provider,
  provider_name,
  status,
  external_consent_id,
  external_account_id,
  sync_error,
  last_sync_at,
  token_expires_at,
  metadata,
  created_at,
  updated_at
FROM public.bank_connections;
-- Deliberately excludes: access_token_encrypted, refresh_token_encrypted, encryption_version
