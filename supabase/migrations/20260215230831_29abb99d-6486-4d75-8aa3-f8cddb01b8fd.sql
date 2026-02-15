
-- =============================================
-- ETAPA 1.3: Rate Limit / API Usage Logs
-- =============================================
CREATE TABLE public.api_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  endpoint text NOT NULL,
  tokens_used integer DEFAULT 0,
  request_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all usage logs"
ON public.api_usage_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their org usage logs"
ON public.api_usage_logs FOR SELECT
USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Service role can insert usage logs"
ON public.api_usage_logs FOR INSERT
WITH CHECK (true);

-- Index for querying usage by org + endpoint + time
CREATE INDEX idx_api_usage_logs_org_endpoint ON public.api_usage_logs (organization_id, endpoint, created_at DESC);

-- =============================================
-- ETAPA 2.1: Performance Indices
-- =============================================
CREATE INDEX IF NOT EXISTS idx_transactions_org_date
ON public.transactions (organization_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_account_date
ON public.transactions (account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_validation_status
ON public.transactions (validation_status);

CREATE INDEX IF NOT EXISTS idx_transactions_import_batch
ON public.transactions (import_batch_id);

CREATE INDEX IF NOT EXISTS idx_transactions_external_id
ON public.transactions (external_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_hash
ON public.transactions (transaction_hash);

-- =============================================
-- ETAPA 2.2: pg_trgm + unaccent for text similarity
-- =============================================
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_transactions_norm_desc_trgm
ON public.transactions USING gin (normalized_description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_transaction_patterns_norm_desc_trgm
ON public.transaction_patterns USING gin (normalized_description gin_trgm_ops);
