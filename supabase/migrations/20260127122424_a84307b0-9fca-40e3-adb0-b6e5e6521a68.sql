-- Add new fields to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Update RLS to allow clients to update their own organization
CREATE POLICY "Clients can update their own organization"
ON public.organizations
FOR UPDATE
USING (
  id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
)
WITH CHECK (
  id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);