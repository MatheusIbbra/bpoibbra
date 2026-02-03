-- ===========================================
-- FIX: transactions RLS policies
-- ===========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view org transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert org transactions" ON public.transactions;
DROP POLICY IF EXISTS "FA+ can update org transactions" ON public.transactions;
DROP POLICY IF EXISTS "FA+ can delete org transactions" ON public.transactions;

-- Recreate with get_viewable_organizations for proper hierarchy access
CREATE POLICY "Users can view org transactions" 
ON public.transactions FOR SELECT 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can insert org transactions" 
ON public.transactions FOR INSERT 
WITH CHECK (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "FA+ can update org transactions" 
ON public.transactions FOR UPDATE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "FA+ can delete org transactions" 
ON public.transactions FOR DELETE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- ===========================================
-- FIX: transfers RLS policies
-- ===========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can insert own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can update own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can delete own transfers" ON public.transfers;

-- Recreate with organization-based access
CREATE POLICY "Users can view org transfers" 
ON public.transfers FOR SELECT 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can insert org transfers" 
ON public.transfers FOR INSERT 
WITH CHECK (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can update org transfers" 
ON public.transfers FOR UPDATE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can delete org transfers" 
ON public.transfers FOR DELETE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- ===========================================
-- FIX: categories RLS policies
-- ===========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view org categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert org categories" ON public.categories;
DROP POLICY IF EXISTS "FA+ can update org categories" ON public.categories;
DROP POLICY IF EXISTS "FA+ can delete org categories" ON public.categories;

-- Recreate with get_viewable_organizations for proper hierarchy access
CREATE POLICY "Users can view org categories" 
ON public.categories FOR SELECT 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "Users can insert org categories" 
ON public.categories FOR INSERT 
WITH CHECK (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "FA+ can update org categories" 
ON public.categories FOR UPDATE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "FA+ can delete org categories" 
ON public.categories FOR DELETE 
USING (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
);