-- Fix RLS policies to require authentication (prevent anonymous access)
-- This addresses the security scan findings about public data exposure

-- Drop and recreate policies for profiles
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    public.can_view_user_data(user_id, auth.uid())
  );

-- Drop and recreate policies for organizations  
DROP POLICY IF EXISTS "Users can view organizations" ON public.organizations;
CREATE POLICY "Users can view organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for accounts
DROP POLICY IF EXISTS "Users can view accounts" ON public.accounts;
CREATE POLICY "Users can view accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for transactions
DROP POLICY IF EXISTS "Users can view transactions" ON public.transactions;
CREATE POLICY "Users can view transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for audit_log
DROP POLICY IF EXISTS "Users can view audit_log" ON public.audit_log;
CREATE POLICY "Users can view audit_log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for organization_members
DROP POLICY IF EXISTS "Users can view organization_members" ON public.organization_members;
CREATE POLICY "Users can view organization_members"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for import_batches
DROP POLICY IF EXISTS "Users can view import_batches" ON public.import_batches;
CREATE POLICY "Users can view import_batches"
  ON public.import_batches FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for categories
DROP POLICY IF EXISTS "Users can view categories" ON public.categories;
CREATE POLICY "Users can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for cost_centers
DROP POLICY IF EXISTS "Users can view cost_centers" ON public.cost_centers;
CREATE POLICY "Users can view cost_centers"
  ON public.cost_centers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for budgets
DROP POLICY IF EXISTS "Users can view budgets" ON public.budgets;
CREATE POLICY "Users can view budgets"
  ON public.budgets FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for transfers
DROP POLICY IF EXISTS "Users can view transfers" ON public.transfers;
CREATE POLICY "Users can view transfers"
  ON public.transfers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for reconciliation_rules
DROP POLICY IF EXISTS "Users can view reconciliation_rules" ON public.reconciliation_rules;
CREATE POLICY "Users can view reconciliation_rules"
  ON public.reconciliation_rules FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for transaction_patterns
DROP POLICY IF EXISTS "Users can view transaction_patterns" ON public.transaction_patterns;
CREATE POLICY "Users can view transaction_patterns"
  ON public.transaction_patterns FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Drop and recreate policies for ai_suggestions
DROP POLICY IF EXISTS "Users can view ai_suggestions" ON public.ai_suggestions;
CREATE POLICY "Users can view ai_suggestions"
  ON public.ai_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = ai_suggestions.transaction_id
      AND t.organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
    )
  );

-- Drop and recreate policies for user_roles
DROP POLICY IF EXISTS "Users can view user_roles" ON public.user_roles;
CREATE POLICY "Users can view user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    public.can_view_user_data(user_id, auth.uid())
  );

-- Drop and recreate policies for user_hierarchy
DROP POLICY IF EXISTS "Users can view user_hierarchy" ON public.user_hierarchy;
CREATE POLICY "Users can view user_hierarchy"
  ON public.user_hierarchy FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    public.can_view_user_data(user_id, auth.uid())
  );

-- Drop and recreate policies for file_imports
DROP POLICY IF EXISTS "Users can view file_imports" ON public.file_imports;
CREATE POLICY "Users can view file_imports"
  ON public.file_imports FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = file_imports.account_id
      AND a.organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
    )
  );