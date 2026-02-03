-- Create reconciliation rules table
CREATE TABLE public.reconciliation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_day INTEGER, -- Day of month (1-31)
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL DEFAULT 'expense',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reconciliation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org reconciliation rules"
ON public.reconciliation_rules
FOR SELECT
USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can insert org reconciliation rules"
ON public.reconciliation_rules
FOR INSERT
WITH CHECK (
  organization_id IN (SELECT get_viewable_organizations(auth.uid()))
  AND user_id = auth.uid()
);

CREATE POLICY "Users can update org reconciliation rules"
ON public.reconciliation_rules
FOR UPDATE
USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can delete org reconciliation rules"
ON public.reconciliation_rules
FOR DELETE
USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

-- Add updated_at trigger
CREATE TRIGGER update_reconciliation_rules_updated_at
BEFORE UPDATE ON public.reconciliation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();