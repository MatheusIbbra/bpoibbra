-- Drop existing SELECT policy for organizations
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;

-- Create new policy that allows admin to view all organizations
CREATE POLICY "Users can view accessible organizations"
ON public.organizations
FOR SELECT
USING (
  -- Admin can see all
  public.has_role(auth.uid(), 'admin')
  OR
  -- Others see organizations in their viewable list
  id IN (SELECT public.get_viewable_organizations(auth.uid()))
);

-- Update the permissions matrix comment: KAM can upload statements
COMMENT ON TABLE public.import_batches IS 'Upload de extratos: Admin, Supervisor, FA, KAM e Cliente podem fazer upload';