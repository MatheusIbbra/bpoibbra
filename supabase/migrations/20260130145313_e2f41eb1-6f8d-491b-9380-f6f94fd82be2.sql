-- Create security definer helper functions for RLS policies

-- Function to check if a user can view a specific profile
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Can view own profile
    _profile_user_id = _viewer_id
    -- Admin can view all
    OR public.has_role(_viewer_id, 'admin')
    -- Can view subordinates' profiles
    OR _profile_user_id IN (SELECT public.get_subordinates(_viewer_id))
$$;

-- Function to check if a user can view a specific organization
CREATE OR REPLACE FUNCTION public.can_view_organization(_org_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org_id IN (SELECT public.get_viewable_organizations(_viewer_id))
$$;

-- Function to check if a user can view a specific transaction
CREATE OR REPLACE FUNCTION public.can_view_transaction(_transaction_org_id uuid, _viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _transaction_org_id IS NULL 
    OR _transaction_org_id IN (SELECT public.get_viewable_organizations(_viewer_id))
$$;

-- Now create the secure policies using the helper functions

-- Profiles: Secure SELECT policy
CREATE POLICY "profiles_select_secure"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_view_profile(user_id, auth.uid()));

-- Organizations: Secure SELECT policy  
CREATE POLICY "organizations_select_secure"
ON public.organizations
FOR SELECT
TO authenticated
USING (public.can_view_organization(id, auth.uid()));

-- Transactions: Secure SELECT policy
CREATE POLICY "transactions_select_secure"
ON public.transactions
FOR SELECT
TO authenticated
USING (public.can_view_transaction(organization_id, auth.uid()));