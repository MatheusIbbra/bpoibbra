-- ══════════════════════════════════════════════════════════
-- Security Hardening: Restrict bank_connections sensitive columns
-- Only service_role can see encrypted tokens
-- ══════════════════════════════════════════════════════════

-- Create a secure view that hides encrypted tokens from regular users
CREATE OR REPLACE VIEW public.bank_connections_safe AS
SELECT
  id,
  organization_id,
  user_id,
  provider,
  provider_name,
  status,
  sync_error,
  last_sync_at,
  token_expires_at,
  external_consent_id,
  external_account_id,
  metadata,
  created_at,
  updated_at,
  -- Hide actual token values from non-service-role
  CASE WHEN auth.role() = 'service_role' THEN access_token_encrypted ELSE '***REDACTED***' END AS access_token_encrypted,
  CASE WHEN auth.role() = 'service_role' THEN refresh_token_encrypted ELSE '***REDACTED***' END AS refresh_token_encrypted
FROM public.bank_connections;

-- Grant access to the view
GRANT SELECT ON public.bank_connections_safe TO authenticated;
GRANT SELECT ON public.bank_connections_safe TO service_role;

-- Add comment for documentation
COMMENT ON VIEW public.bank_connections_safe IS 'Secure view of bank_connections that redacts encrypted tokens for non-service-role users';