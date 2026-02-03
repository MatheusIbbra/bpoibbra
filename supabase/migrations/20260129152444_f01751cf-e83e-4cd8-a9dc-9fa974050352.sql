-- =============================================
-- SECURITY FIX: Tighten profiles and audit_log policies
-- =============================================

-- 1. PROFILES - Restrict to own profile or viewable via hierarchy
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users only" ON public.profiles;

CREATE POLICY "profiles_select_restricted"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Own profile
  user_id = auth.uid()
  -- Admin can see all
  OR public.has_role(auth.uid(), 'admin')
  -- Supervisor/FA/KAM can see subordinates
  OR user_id IN (SELECT public.get_subordinates(auth.uid()))
  -- Users in same organization
  OR user_id IN (
    SELECT om.user_id 
    FROM public.organization_members om 
    WHERE om.organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  )
);

-- 2. AUDIT_LOG - Restrict INSERT to service role only (remove user insert capability)
DROP POLICY IF EXISTS "Authenticated users can create audit entries" ON public.audit_log;
DROP POLICY IF EXISTS "Users can create audit entries" ON public.audit_log;

-- Note: Audit entries should only be created by triggers (which run as SECURITY DEFINER)
-- No direct user INSERT policy needed