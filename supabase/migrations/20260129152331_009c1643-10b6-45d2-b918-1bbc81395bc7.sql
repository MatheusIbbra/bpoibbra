-- =============================================
-- SECURITY FIX: Require authentication for all SELECT policies
-- This migration updates RLS policies to ensure no data is accessible without authentication
-- =============================================

-- Drop existing permissive SELECT policies and recreate with auth check

-- 1. PROFILES TABLE
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Profiles are viewable by authenticated users only"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. ACCOUNTS TABLE
DROP POLICY IF EXISTS "Users can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "accounts_select_policy" ON public.accounts;

CREATE POLICY "accounts_select_authenticated"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 3. TRANSACTIONS TABLE
DROP POLICY IF EXISTS "Users can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_policy" ON public.transactions;

CREATE POLICY "transactions_select_authenticated"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 4. ORGANIZATIONS TABLE
DROP POLICY IF EXISTS "Organizations are viewable by members" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;

CREATE POLICY "organizations_select_authenticated"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 5. AUDIT_LOG TABLE - Only admins should see this
DROP POLICY IF EXISTS "Audit logs are viewable" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_policy" ON public.audit_log;

CREATE POLICY "audit_log_select_admin_only"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())))
);

-- 6. USER_ROLES TABLE - Only viewable by authenticated users
DROP POLICY IF EXISTS "User roles are viewable" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;

CREATE POLICY "user_roles_select_authenticated"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
);

-- 7. BUDGETS TABLE
DROP POLICY IF EXISTS "Users can view budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can view their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "budgets_select_policy" ON public.budgets;

CREATE POLICY "budgets_select_authenticated"
ON public.budgets
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 8. CATEGORIES TABLE
DROP POLICY IF EXISTS "Users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;

CREATE POLICY "categories_select_authenticated"
ON public.categories
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 9. COST_CENTERS TABLE
DROP POLICY IF EXISTS "Users can view cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Users can view their own cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "cost_centers_select_policy" ON public.cost_centers;

CREATE POLICY "cost_centers_select_authenticated"
ON public.cost_centers
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 10. TRANSFERS TABLE
DROP POLICY IF EXISTS "Users can view transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can view their own transfers" ON public.transfers;
DROP POLICY IF EXISTS "transfers_select_policy" ON public.transfers;

CREATE POLICY "transfers_select_authenticated"
ON public.transfers
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 11. AI_SUGGESTIONS TABLE
DROP POLICY IF EXISTS "Users can view AI suggestions" ON public.ai_suggestions;
DROP POLICY IF EXISTS "Users can view their own AI suggestions" ON public.ai_suggestions;
DROP POLICY IF EXISTS "ai_suggestions_select_policy" ON public.ai_suggestions;

CREATE POLICY "ai_suggestions_select_authenticated"
ON public.ai_suggestions
FOR SELECT
TO authenticated
USING (
  transaction_id IN (
    SELECT id FROM public.transactions 
    WHERE organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  )
);

-- 12. IMPORT_BATCHES TABLE
DROP POLICY IF EXISTS "Users can view import batches" ON public.import_batches;
DROP POLICY IF EXISTS "Users can view their own import batches" ON public.import_batches;
DROP POLICY IF EXISTS "import_batches_select_policy" ON public.import_batches;

CREATE POLICY "import_batches_select_authenticated"
ON public.import_batches
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 13. FILE_IMPORTS TABLE
DROP POLICY IF EXISTS "Users can view file imports" ON public.file_imports;
DROP POLICY IF EXISTS "Users can view their own file imports" ON public.file_imports;
DROP POLICY IF EXISTS "file_imports_select_policy" ON public.file_imports;

CREATE POLICY "file_imports_select_authenticated"
ON public.file_imports
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR account_id IN (
    SELECT id FROM public.accounts 
    WHERE organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  )
);

-- 14. RECONCILIATION_RULES TABLE
DROP POLICY IF EXISTS "Users can view reconciliation rules" ON public.reconciliation_rules;
DROP POLICY IF EXISTS "Users can view their own reconciliation rules" ON public.reconciliation_rules;
DROP POLICY IF EXISTS "reconciliation_rules_select_policy" ON public.reconciliation_rules;

CREATE POLICY "reconciliation_rules_select_authenticated"
ON public.reconciliation_rules
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 15. TRANSACTION_PATTERNS TABLE
DROP POLICY IF EXISTS "Users can view transaction patterns" ON public.transaction_patterns;
DROP POLICY IF EXISTS "Users can view their own transaction patterns" ON public.transaction_patterns;
DROP POLICY IF EXISTS "transaction_patterns_select_policy" ON public.transaction_patterns;

CREATE POLICY "transaction_patterns_select_authenticated"
ON public.transaction_patterns
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- 16. ORGANIZATION_MEMBERS TABLE
DROP POLICY IF EXISTS "Users can view organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Members can view their organization members" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_select_policy" ON public.organization_members;

CREATE POLICY "organization_members_select_authenticated"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  OR user_id = auth.uid()
);

-- 17. USER_HIERARCHY TABLE
DROP POLICY IF EXISTS "Users can view user hierarchy" ON public.user_hierarchy;
DROP POLICY IF EXISTS "Users can view their own hierarchy" ON public.user_hierarchy;
DROP POLICY IF EXISTS "user_hierarchy_select_policy" ON public.user_hierarchy;

CREATE POLICY "user_hierarchy_select_authenticated"
ON public.user_hierarchy
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR supervisor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
);