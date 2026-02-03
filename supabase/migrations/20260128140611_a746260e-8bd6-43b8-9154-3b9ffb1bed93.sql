-- Create a security definer function to check if user can manage organization members
CREATE OR REPLACE FUNCTION public.can_manage_org_members(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = _user_id 
      AND om.organization_id = _org_id
      AND om.role IN ('admin', 'supervisor')
    )
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can manage org members" ON public.organization_members;

-- Create new policy using the security definer function
CREATE POLICY "Admins can manage org members"
ON public.organization_members
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.can_manage_org_members(auth.uid(), organization_id)
);

-- Also fix the SELECT policy to use a security definer function
DROP POLICY IF EXISTS "Users can view members of their orgs" ON public.organization_members;

-- Create function to get user organizations without recursion
CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id
$$;

CREATE POLICY "Users can view members of their orgs"
ON public.organization_members
FOR SELECT
USING (
  organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
);