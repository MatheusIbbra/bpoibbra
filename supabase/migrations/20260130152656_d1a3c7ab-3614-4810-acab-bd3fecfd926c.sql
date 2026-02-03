-- Remove políticas duplicadas e redundantes que podem criar brechas de segurança

-- audit_log: Remover políticas que permitem acesso via organization_id
-- Manter apenas acesso para admin e próprio usuário
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Service role can create audit entries" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view own audit entries" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_no_delete" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_no_update" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_admin_only" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_secure" ON public.audit_log;

-- Recriar políticas consolidadas para audit_log
CREATE POLICY "audit_log_select_admin_only" ON public.audit_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "audit_log_no_update" ON public.audit_log
  FOR UPDATE USING (false);

CREATE POLICY "audit_log_no_delete" ON public.audit_log
  FOR DELETE USING (false);

-- accounts: Remover política duplicada, manter apenas a segura
DROP POLICY IF EXISTS "accounts_select_secure" ON public.accounts;

CREATE POLICY "accounts_select_secure" ON public.accounts
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR organization_id IN (SELECT get_viewable_organizations(auth.uid()))
    )
  );

-- transactions: Remover política redundante, manter apenas a segura
DROP POLICY IF EXISTS "Users can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_secure" ON public.transactions;

CREATE POLICY "transactions_select_secure" ON public.transactions
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND can_view_transaction(organization_id, auth.uid())
  );