
-- Create family_members table to store relatives of users
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  relationship TEXT NOT NULL, -- e.g. 'cônjuge', 'filho(a)', 'pai/mãe', 'irmão(ã)', 'outro'
  full_name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Users can view their own family members
CREATE POLICY "Users can view own family members"
ON public.family_members
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own family members
CREATE POLICY "Users can insert own family members"
ON public.family_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own family members
CREATE POLICY "Users can update own family members"
ON public.family_members
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own family members
CREATE POLICY "Users can delete own family members"
ON public.family_members
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all family members"
ON public.family_members
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_family_members_updated_at
BEFORE UPDATE ON public.family_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
