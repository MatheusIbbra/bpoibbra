-- Allow authenticated users to create their own organization during onboarding
CREATE POLICY "Authenticated users can create own organization"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);
