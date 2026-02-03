-- Allow KAM to insert import batches (create uploads)
DROP POLICY IF EXISTS "Users can create import batches in their org" ON public.import_batches;

CREATE POLICY "Users can create import batches in their org"
ON public.import_batches
FOR INSERT
WITH CHECK (
  (organization_id IN (SELECT public.get_user_organizations(auth.uid())))
  AND (user_id = auth.uid())
);