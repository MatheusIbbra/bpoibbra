-- Drop the restrictive policy that requires ALL to pass
DROP POLICY IF EXISTS "Users can create own base organization" ON public.organizations;

-- Create PERMISSIVE policy so either admin OR own-base check passes
CREATE POLICY "Users can create own base organization"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (slug = 'base-' || substring(auth.uid()::text from 1 for 8));

-- Also need to allow users to insert themselves as org members during onboarding
CREATE POLICY "Users can join own new organization"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow users to create subscription for their own new org
CREATE POLICY "Users can create own org subscription"
ON public.organization_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
  )
);
