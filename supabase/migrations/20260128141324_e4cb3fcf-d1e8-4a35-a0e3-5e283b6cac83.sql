-- Add RLS policy for global admins to update any organization
CREATE POLICY "Global admins can update any organization"
ON public.organizations
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));