-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can create own organization" ON public.organizations;

-- Create a more restrictive policy: user can only create orgs with slug matching their user id prefix
CREATE POLICY "Users can create own base organization"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (slug = 'base-' || substring(auth.uid()::text from 1 for 8));
