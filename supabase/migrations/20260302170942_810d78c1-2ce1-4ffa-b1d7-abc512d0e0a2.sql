
-- =============================================================
-- FIX: Remove conflicting RESTRICTIVE SELECT policies
-- In Postgres, ALL RESTRICTIVE policies must pass simultaneously.
-- Having admin-only + user-scoped RESTRICTIVE policies means
-- non-admin users are blocked from their own data.
-- The _secure policies already handle admin access via security
-- definer functions (can_view_profile, can_view_transaction, etc.)
-- =============================================================

-- 1. PROFILES: Drop redundant admin-only SELECT (can_view_profile already checks admin)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 2. FAMILY_MEMBERS: Drop admin-only SELECT and consolidate into one policy
DROP POLICY IF EXISTS "Admins can view all family members" ON public.family_members;
DROP POLICY IF EXISTS "Users can view own family members" ON public.family_members;

-- Create single RESTRICTIVE policy that handles both cases
CREATE POLICY "family_members_select_secure"
  ON public.family_members
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR user_id IN (SELECT public.get_subordinates(auth.uid()))
  );

-- 3. API_USAGE_LOGS: Drop admin-only SELECT (org-scoped policy handles it)
DROP POLICY IF EXISTS "Admins can view all usage logs" ON public.api_usage_logs;
DROP POLICY IF EXISTS "Users can view their org usage logs" ON public.api_usage_logs;

CREATE POLICY "api_usage_logs_select_secure"
  ON public.api_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- 4. CONSENT_LOGS: Drop conflicting duplicate SELECT policies
DROP POLICY IF EXISTS "Admins can view all consent" ON public.consent_logs;
DROP POLICY IF EXISTS "Users can view own consent" ON public.consent_logs;

CREATE POLICY "consent_logs_select_secure"
  ON public.consent_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 5. ORGANIZATION_MEMBERS: Drop redundant duplicate SELECT policies
DROP POLICY IF EXISTS "Users can view members of their orgs" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view organization_members" ON public.organization_members;
-- Keep only organization_members_select_secure which already handles all cases

-- 6. BUDGETS: Drop user-only SELECT (budgets_select_secure handles it)
DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;

-- 7. AI_SUGGESTIONS: Drop duplicate SELECT
DROP POLICY IF EXISTS "Users can view AI suggestions for their org transactions" ON public.ai_suggestions;
-- Keep only ai_suggestions_select_secure

-- 8. IMPORT_BATCHES: Drop duplicate SELECT
DROP POLICY IF EXISTS "Users can view their org import batches" ON public.import_batches;
-- Keep only import_batches_select_secure

-- 9. RECONCILIATION_RULES: Drop duplicate SELECT
DROP POLICY IF EXISTS "Users can view org reconciliation rules" ON public.reconciliation_rules;
-- Keep only reconciliation_rules_select_secure

-- 10. COST_CENTERS: Drop old policy, keep only cost_centers_select_secure
-- (There's no duplicate here, cost_centers only has cost_centers_select_secure for SELECT)

-- 11. USER_HIERARCHY: Drop duplicate SELECT policies
DROP POLICY IF EXISTS "Supervisors can view their subordinates hierarchy" ON public.user_hierarchy;
-- Keep only user_hierarchy_select_secure

-- 12. TRANSACTION_PATTERNS: Drop duplicate SELECT
DROP POLICY IF EXISTS "Users can view patterns from viewable organizations" ON public.transaction_patterns;
-- Keep only transaction_patterns_select_secure
