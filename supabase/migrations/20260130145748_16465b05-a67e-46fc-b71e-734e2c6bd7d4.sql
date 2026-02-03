-- Ensure all tables have proper authenticated-only SELECT policies

-- Check and create secure policies for accounts
DROP POLICY IF EXISTS "Users can view org accounts" ON public.accounts;
CREATE POLICY "accounts_select_secure"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for audit_log
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view org audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_authenticated" ON public.audit_log;
CREATE POLICY "audit_log_select_secure"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR user_id = auth.uid()
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for organization_members
DROP POLICY IF EXISTS "Members can view own organization" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can view all memberships" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view org memberships" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_select_authenticated" ON public.organization_members;
CREATE POLICY "organization_members_select_secure"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for budgets
DROP POLICY IF EXISTS "Users can view org budgets" ON public.budgets;
CREATE POLICY "budgets_select_secure"
ON public.budgets
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for transfers
DROP POLICY IF EXISTS "Users can view org transfers" ON public.transfers;
CREATE POLICY "transfers_select_secure"
ON public.transfers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for categories
DROP POLICY IF EXISTS "Users can view org categories" ON public.categories;
CREATE POLICY "categories_select_secure"
ON public.categories
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for cost_centers
DROP POLICY IF EXISTS "Users can view org cost_centers" ON public.cost_centers;
CREATE POLICY "cost_centers_select_secure"
ON public.cost_centers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for reconciliation_rules
DROP POLICY IF EXISTS "Users can view org reconciliation_rules" ON public.reconciliation_rules;
CREATE POLICY "reconciliation_rules_select_secure"
ON public.reconciliation_rules
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for transaction_patterns
DROP POLICY IF EXISTS "Users can view org transaction_patterns" ON public.transaction_patterns;
CREATE POLICY "transaction_patterns_select_secure"
ON public.transaction_patterns
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for import_batches
DROP POLICY IF EXISTS "Users can view org import_batches" ON public.import_batches;
CREATE POLICY "import_batches_select_secure"
ON public.import_batches
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Check and create secure policies for user_hierarchy  
DROP POLICY IF EXISTS "Admins can view all hierarchy" ON public.user_hierarchy;
DROP POLICY IF EXISTS "Users can view own hierarchy" ON public.user_hierarchy;
CREATE POLICY "user_hierarchy_select_secure"
ON public.user_hierarchy
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR supervisor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Check and create secure policies for user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "user_roles_select_secure"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Check and create secure policies for file_imports
DROP POLICY IF EXISTS "Users can view own imports" ON public.file_imports;
CREATE POLICY "file_imports_select_secure"
ON public.file_imports
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Check and create secure policies for ai_suggestions (based on transaction access)
DROP POLICY IF EXISTS "FA+ can view suggestions" ON public.ai_suggestions;
DROP POLICY IF EXISTS "ai_suggestions_select_fa" ON public.ai_suggestions;
CREATE POLICY "ai_suggestions_select_secure"
ON public.ai_suggestions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.id = transaction_id 
    AND (
      public.has_role(auth.uid(), 'admin')
      OR t.organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
    )
  )
);