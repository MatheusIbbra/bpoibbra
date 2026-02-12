
-- 1. Financial Entities (PF, Holding, Empresa)
CREATE TABLE public.financial_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('pf', 'holding', 'empresa')),
  parent_entity_id UUID REFERENCES public.financial_entities(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org financial entities" ON public.financial_entities
  FOR SELECT USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can insert org financial entities" ON public.financial_entities
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can update org financial entities" ON public.financial_entities
  FOR UPDATE USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can delete org financial entities" ON public.financial_entities
  FOR DELETE USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

CREATE TRIGGER update_financial_entities_updated_at
  BEFORE UPDATE ON public.financial_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Patrimony Assets
CREATE TABLE public.patrimony_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES public.financial_entities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('conta', 'investimento', 'imovel', 'participacao', 'outro')),
  description TEXT NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  liquidity TEXT NOT NULL DEFAULT 'media' CHECK (liquidity IN ('alta', 'media', 'baixa')),
  reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patrimony_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org patrimony assets" ON public.patrimony_assets
  FOR SELECT USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can insert org patrimony assets" ON public.patrimony_assets
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can update org patrimony assets" ON public.patrimony_assets
  FOR UPDATE USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can delete org patrimony assets" ON public.patrimony_assets
  FOR DELETE USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

CREATE TRIGGER update_patrimony_assets_updated_at
  BEFORE UPDATE ON public.patrimony_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_patrimony_assets_entity ON public.patrimony_assets(entity_id);
CREATE INDEX idx_patrimony_assets_org ON public.patrimony_assets(organization_id);

-- 3. Patrimony Liabilities
CREATE TABLE public.patrimony_liabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES public.financial_entities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  liability_type TEXT NOT NULL DEFAULT 'outro' CHECK (liability_type IN ('emprestimo', 'financiamento', 'divida', 'outro')),
  description TEXT NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patrimony_liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org patrimony liabilities" ON public.patrimony_liabilities
  FOR SELECT USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can insert org patrimony liabilities" ON public.patrimony_liabilities
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can update org patrimony liabilities" ON public.patrimony_liabilities
  FOR UPDATE USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can delete org patrimony liabilities" ON public.patrimony_liabilities
  FOR DELETE USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

CREATE TRIGGER update_patrimony_liabilities_updated_at
  BEFORE UPDATE ON public.patrimony_liabilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_patrimony_liabilities_entity ON public.patrimony_liabilities(entity_id);

-- 4. Patrimony History (monthly snapshots)
CREATE TABLE public.patrimony_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_id UUID REFERENCES public.financial_entities(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL DEFAULT 'entity' CHECK (snapshot_type IN ('entity', 'consolidated')),
  period TEXT NOT NULL, -- format: YYYY-MM
  total_assets NUMERIC NOT NULL DEFAULT 0,
  total_liabilities NUMERIC NOT NULL DEFAULT 0,
  net_worth NUMERIC NOT NULL DEFAULT 0,
  assets_breakdown JSONB DEFAULT '{}',
  liquidity_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, entity_id, period, snapshot_type)
);

ALTER TABLE public.patrimony_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org patrimony history" ON public.patrimony_history
  FOR SELECT USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can insert org patrimony history" ON public.patrimony_history
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_viewable_organizations(auth.uid())));
CREATE POLICY "Users can update org patrimony history" ON public.patrimony_history
  FOR UPDATE USING (organization_id IN (SELECT get_viewable_organizations(auth.uid())));

CREATE INDEX idx_patrimony_history_org_period ON public.patrimony_history(organization_id, period);
