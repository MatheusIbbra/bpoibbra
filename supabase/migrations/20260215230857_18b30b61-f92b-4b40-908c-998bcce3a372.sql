
-- Fix permissive INSERT policy on api_usage_logs
DROP POLICY "Service role can insert usage logs" ON public.api_usage_logs;

-- Only allow inserts when auth is present and org belongs to user, or via service_role
CREATE POLICY "Authenticated users can insert usage logs"
ON public.api_usage_logs FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    organization_id IS NULL 
    OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  )
);
