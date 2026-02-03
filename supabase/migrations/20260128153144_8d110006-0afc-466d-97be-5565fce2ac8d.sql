-- Drop existing policies on accounts
DROP POLICY IF EXISTS "Users can view org accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert org accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update org accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete org accounts" ON public.accounts;

-- Create new policies for accounts using get_viewable_organizations
CREATE POLICY "Users can view org accounts" 
ON public.accounts 
FOR SELECT 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can insert org accounts" 
ON public.accounts 
FOR INSERT 
WITH CHECK (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update org accounts" 
ON public.accounts 
FOR UPDATE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete org accounts" 
ON public.accounts 
FOR DELETE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- Drop existing policies on cost_centers
DROP POLICY IF EXISTS "Users can view own cost_centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Users can insert own cost_centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Users can update own cost_centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Users can delete own cost_centers" ON public.cost_centers;

-- Create new organization-based policies for cost_centers
CREATE POLICY "Users can view org cost_centers" 
ON public.cost_centers 
FOR SELECT 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can insert org cost_centers" 
ON public.cost_centers 
FOR INSERT 
WITH CHECK (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update org cost_centers" 
ON public.cost_centers 
FOR UPDATE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete org cost_centers" 
ON public.cost_centers 
FOR DELETE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);