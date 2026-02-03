-- Fix import_batches INSERT policy to use hierarchy-based access
DROP POLICY IF EXISTS "Users can create import batches in their org" ON public.import_batches;

-- Allow INSERT for users who can view the organization (via hierarchy)
CREATE POLICY "Users can create import batches in their org"
ON public.import_batches
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  AND user_id = auth.uid()
);

-- Also fix SELECT policy to use get_viewable_organizations for consistency
DROP POLICY IF EXISTS "Users can view their org import batches" ON public.import_batches;

CREATE POLICY "Users can view their org import batches"
ON public.import_batches
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Fix UPDATE policy to use get_viewable_organizations
DROP POLICY IF EXISTS "FA+ can update import batches" ON public.import_batches;

CREATE POLICY "FA+ can update import batches"
ON public.import_batches
FOR UPDATE
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Fix DELETE policy to use get_viewable_organizations  
DROP POLICY IF EXISTS "FA+ can delete import batches" ON public.import_batches;

CREATE POLICY "FA+ can delete import batches"
ON public.import_batches
FOR DELETE
TO authenticated
USING (
  organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
);