-- Drop existing restrictive policies on categories
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

-- Create new organization-based policies for categories

-- SELECT: Users can view categories from their organizations
CREATE POLICY "Users can view org categories" 
ON public.categories 
FOR SELECT 
USING (
  organization_id IN (SELECT get_user_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- INSERT: Users can create categories in their organizations
CREATE POLICY "Users can insert org categories" 
ON public.categories 
FOR INSERT 
WITH CHECK (
  organization_id IN (SELECT get_user_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- UPDATE: FA+ can update org categories
CREATE POLICY "FA+ can update org categories" 
ON public.categories 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'supervisor', 'fa')
  )
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- DELETE: FA+ can delete org categories  
CREATE POLICY "FA+ can delete org categories" 
ON public.categories 
FOR DELETE 
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'supervisor', 'fa')
  )
  OR (organization_id IS NULL AND user_id = auth.uid())
);