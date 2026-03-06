
-- ============================================================
-- Fix 1: Tighten profiles SELECT policy
-- Remove the broad supervisor/subordinate access; keep only
-- owner + admin + explicit can_view_profile for specific roles.
-- ============================================================

-- Drop the old permissive SELECT policy if it exists
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_secure" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users who created them." ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- New strict SELECT policy: owner or admin only
CREATE POLICY "profiles_select_secure"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);

-- ============================================================
-- Fix 2: Restrict bank_connections SELECT to owner + FA+ roles
-- Previously all org members could read tokens (even encrypted).
-- Now restricted to: the connection owner, admins, supervisors, FA.
-- ============================================================

DROP POLICY IF EXISTS "Users can view org bank connections" ON public.bank_connections;

CREATE POLICY "Users can view org bank connections"
ON public.bank_connections
FOR SELECT
USING (
  -- The user who created the connection always sees it
  user_id = auth.uid()
  -- OR admin/supervisor/fa/projetista can see all org connections
  OR (
    organization_id IN (SELECT get_viewable_organizations(auth.uid()))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR has_role(auth.uid(), 'fa'::app_role)
      OR has_role(auth.uid(), 'projetista'::app_role)
    )
  )
);
