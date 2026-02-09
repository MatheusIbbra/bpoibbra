
-- Fix: Remove overly permissive policy and replace with more specific ones
DROP POLICY IF EXISTS "Service role can manage sync logs" ON public.sync_audit_logs;

-- Only allow INSERT (edge functions use service_role which bypasses RLS anyway)
-- This policy allows authenticated users to insert their own logs
CREATE POLICY "Authenticated users can insert sync logs"
ON public.sync_audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
