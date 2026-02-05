-- Corrigir policy permissiva de integration_logs
DROP POLICY IF EXISTS "Service role can insert logs" ON public.integration_logs;

-- Criar policy mais restritiva para insert de logs
CREATE POLICY "Authenticated users can insert logs for their org"
  ON public.integration_logs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
      organization_id IS NULL 
      OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
    )
  );