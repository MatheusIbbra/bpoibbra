
-- Fix monthly_plans UPDATE and DELETE policies to check org membership instead of user_id
-- Upserts by other org members (e.g. admin) were failing because UPDATE required auth.uid() = user_id

DROP POLICY IF EXISTS "monthly_plans_update" ON public.monthly_plans;
DROP POLICY IF EXISTS "monthly_plans_delete" ON public.monthly_plans;
DROP POLICY IF EXISTS "monthly_plans_insert" ON public.monthly_plans;

-- INSERT: user_id must match authenticated user + org accessible
CREATE POLICY "monthly_plans_insert"
ON public.monthly_plans
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND organization_id IN (SELECT get_viewable_organizations(auth.uid()))
);

-- UPDATE: any org member can update (not restricted to original creator)
CREATE POLICY "monthly_plans_update"
ON public.monthly_plans
FOR UPDATE
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
);

-- DELETE: any org member can delete
CREATE POLICY "monthly_plans_delete"
ON public.monthly_plans
FOR DELETE
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
);

-- ROLLBACK: DROP above policies and recreate with (auth.uid() = user_id AND organization_id IN (...)) conditions
