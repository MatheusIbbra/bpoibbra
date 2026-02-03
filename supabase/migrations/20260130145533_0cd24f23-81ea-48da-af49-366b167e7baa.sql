-- Add explicit DELETE/UPDATE restrictions on audit_log
CREATE POLICY "audit_log_no_delete"
ON public.audit_log
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "audit_log_no_update"
ON public.audit_log
FOR UPDATE
TO authenticated
USING (false);

-- Remove duplicate policies that were identified across tables

-- accounts duplicates
DROP POLICY IF EXISTS "Users can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "accounts_select_authenticated" ON public.accounts;

-- categories duplicates
DROP POLICY IF EXISTS "Users can view categories" ON public.categories;
DROP POLICY IF EXISTS "categories_select_authenticated" ON public.categories;

-- cost_centers duplicates
DROP POLICY IF EXISTS "Users can view cost_centers" ON public.cost_centers;
DROP POLICY IF EXISTS "cost_centers_select_authenticated" ON public.cost_centers;

-- file_imports duplicates
DROP POLICY IF EXISTS "Users can view file_imports" ON public.file_imports;
DROP POLICY IF EXISTS "file_imports_select_authenticated" ON public.file_imports;

-- user_roles duplicates
DROP POLICY IF EXISTS "Users can view user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;

-- budgets duplicates
DROP POLICY IF EXISTS "Users can view budgets" ON public.budgets;
DROP POLICY IF EXISTS "budgets_select_authenticated" ON public.budgets;

-- transfers duplicates
DROP POLICY IF EXISTS "Users can view transfers" ON public.transfers;
DROP POLICY IF EXISTS "transfers_select_authenticated" ON public.transfers;

-- reconciliation_rules duplicates
DROP POLICY IF EXISTS "Users can view reconciliation_rules" ON public.reconciliation_rules;
DROP POLICY IF EXISTS "reconciliation_rules_select_authenticated" ON public.reconciliation_rules;

-- import_batches duplicates
DROP POLICY IF EXISTS "Users can view import_batches" ON public.import_batches;
DROP POLICY IF EXISTS "import_batches_select_authenticated" ON public.import_batches;

-- user_hierarchy duplicates
DROP POLICY IF EXISTS "Users can view user_hierarchy" ON public.user_hierarchy;
DROP POLICY IF EXISTS "user_hierarchy_select_authenticated" ON public.user_hierarchy;

-- transaction_patterns duplicates
DROP POLICY IF EXISTS "Users can view transaction_patterns" ON public.transaction_patterns;
DROP POLICY IF EXISTS "transaction_patterns_select_authenticated" ON public.transaction_patterns;

-- ai_suggestions duplicates
DROP POLICY IF EXISTS "Users can view ai_suggestions" ON public.ai_suggestions;
DROP POLICY IF EXISTS "ai_suggestions_select_authenticated" ON public.ai_suggestions;