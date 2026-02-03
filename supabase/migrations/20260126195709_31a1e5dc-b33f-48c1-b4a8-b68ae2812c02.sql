-- =====================================================
-- MULTI-TENANT SYSTEM: Organizations & Import Flow
-- =====================================================

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create organization_members junction table
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Function to check if user belongs to organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- Function to get user's organizations
CREATE OR REPLACE FUNCTION public.get_user_organizations(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id
$$;

-- RLS for organizations
CREATE POLICY "Users can view their organizations" ON public.organizations
  FOR SELECT USING (id IN (SELECT get_user_organizations(auth.uid())));

CREATE POLICY "Admins can create organizations" ON public.organizations
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can update their organization" ON public.organizations
  FOR UPDATE USING (
    id IN (SELECT organization_id FROM organization_members 
           WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS for organization_members
CREATE POLICY "Users can view members of their orgs" ON public.organization_members
  FOR SELECT USING (organization_id IN (SELECT get_user_organizations(auth.uid())));

CREATE POLICY "Admins can manage org members" ON public.organization_members
  FOR ALL USING (
    has_role(auth.uid(), 'admin') OR
    (organization_id IN (SELECT organization_id FROM organization_members 
                         WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')))
  );

-- Add organization_id to existing tables
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.cost_centers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Trigger for updated_at on organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();