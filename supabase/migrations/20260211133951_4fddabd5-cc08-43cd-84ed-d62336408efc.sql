
-- =============================================
-- Table: open_finance_items
-- =============================================
CREATE TABLE public.open_finance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  pluggy_item_id TEXT NOT NULL UNIQUE,
  connector_id TEXT,
  institution_name TEXT NOT NULL,
  institution_type TEXT,
  
  status TEXT NOT NULL DEFAULT 'pending',
  execution_status TEXT,
  
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_frequency TEXT DEFAULT 'daily',
  
  products JSONB DEFAULT '[]'::jsonb,
  
  error_message TEXT,
  error_code TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, pluggy_item_id)
);

ALTER TABLE public.open_finance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org items"
  ON public.open_finance_items FOR SELECT
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can insert items for their org"
  ON public.open_finance_items FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())) AND user_id = auth.uid());

CREATE POLICY "Users can update their org items"
  ON public.open_finance_items FOR UPDATE
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can delete their org items"
  ON public.open_finance_items FOR DELETE
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE INDEX idx_open_finance_items_org ON open_finance_items(organization_id);
CREATE INDEX idx_open_finance_items_pluggy ON open_finance_items(pluggy_item_id);
CREATE INDEX idx_open_finance_items_status ON open_finance_items(status);

-- =============================================
-- Table: open_finance_accounts
-- =============================================
CREATE TABLE public.open_finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.open_finance_items(id) ON DELETE CASCADE,
  
  pluggy_account_id TEXT NOT NULL,
  account_number TEXT,
  account_type TEXT,
  subtype TEXT,
  
  name TEXT NOT NULL,
  balance DECIMAL(15,2),
  currency_code TEXT DEFAULT 'BRL',
  
  credit_limit DECIMAL(15,2),
  available_credit DECIMAL(15,2),
  closing_day INTEGER,
  due_day INTEGER,
  
  local_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  
  raw_data JSONB,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, pluggy_account_id)
);

ALTER TABLE public.open_finance_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org OF accounts"
  ON public.open_finance_accounts FOR SELECT
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can insert OF accounts for their org"
  ON public.open_finance_accounts FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can update their org OF accounts"
  ON public.open_finance_accounts FOR UPDATE
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can delete their org OF accounts"
  ON public.open_finance_accounts FOR DELETE
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE INDEX idx_of_accounts_org ON open_finance_accounts(organization_id);
CREATE INDEX idx_of_accounts_item ON open_finance_accounts(item_id);
CREATE INDEX idx_of_accounts_pluggy ON open_finance_accounts(pluggy_account_id);

-- =============================================
-- Table: open_finance_sync_logs
-- =============================================
CREATE TABLE public.open_finance_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.open_finance_items(id) ON DELETE CASCADE,
  
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  
  records_fetched INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  error_message TEXT,
  error_details JSONB,
  
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.open_finance_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org sync logs"
  ON public.open_finance_sync_logs FOR SELECT
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can insert sync logs for their org"
  ON public.open_finance_sync_logs FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE INDEX idx_sync_logs_org ON open_finance_sync_logs(organization_id);
CREATE INDEX idx_sync_logs_item ON open_finance_sync_logs(item_id);
CREATE INDEX idx_sync_logs_created ON open_finance_sync_logs(created_at DESC);
CREATE INDEX idx_sync_logs_status ON open_finance_sync_logs(status);

-- =============================================
-- Table: open_finance_raw_data
-- =============================================
CREATE TABLE public.open_finance_raw_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.open_finance_items(id) ON DELETE CASCADE,
  
  data_type TEXT NOT NULL,
  external_id TEXT,
  
  raw_json JSONB NOT NULL,
  
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, data_type, external_id)
);

ALTER TABLE public.open_finance_raw_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org raw data"
  ON public.open_finance_raw_data FOR SELECT
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can insert raw data for their org"
  ON public.open_finance_raw_data FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE INDEX idx_raw_data_org ON open_finance_raw_data(organization_id);
CREATE INDEX idx_raw_data_item ON open_finance_raw_data(item_id);
CREATE INDEX idx_raw_data_type ON open_finance_raw_data(data_type);
CREATE INDEX idx_raw_data_unprocessed ON open_finance_raw_data(processed) WHERE processed = FALSE;

-- =============================================
-- Trigger for updated_at on new tables
-- =============================================
CREATE TRIGGER update_open_finance_items_updated_at
  BEFORE UPDATE ON public.open_finance_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_open_finance_accounts_updated_at
  BEFORE UPDATE ON public.open_finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
