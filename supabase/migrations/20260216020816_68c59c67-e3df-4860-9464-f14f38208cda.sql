
-- Fix the permissive INSERT policy: only allow inserts from service role (no authenticated user inserts)
DROP POLICY IF EXISTS "Service role can insert security events" ON public.security_events;

-- Instead, don't create an INSERT policy at all - service_role bypasses RLS.
-- This means only service_role can insert, which is exactly what we want.
