
-- =====================================================
-- ETAPA 2: PERFORMANCE & ESCALABILIDADE
-- =====================================================

-- 2.2 Índices complementares (os principais já existem)
-- Índice em accounts por organization_id (faltava)
CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON public.accounts (organization_id);

-- Índice em accounts por status para filtros frequentes
CREATE INDEX IF NOT EXISTS idx_accounts_org_status ON public.accounts (organization_id, status);

-- Índice em budgets por organização + período
CREATE INDEX IF NOT EXISTS idx_budgets_org_period ON public.budgets (organization_id, year, month);

-- Índice em categories por organização
CREATE INDEX IF NOT EXISTS idx_categories_org_id ON public.categories (organization_id);

-- Índice em cost_centers por organização
CREATE INDEX IF NOT EXISTS idx_cost_centers_org_id ON public.cost_centers (organization_id);

-- Índice em transaction_patterns para lookup rápido
CREATE INDEX IF NOT EXISTS idx_tx_patterns_org_type ON public.transaction_patterns (organization_id, transaction_type);

-- Índice em security_events para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_security_events_org_type ON public.security_events (organization_id, event_type, created_at DESC);

-- Índice em api_usage_logs para rate limiting
CREATE INDEX IF NOT EXISTS idx_api_usage_org_endpoint ON public.api_usage_logs (organization_id, endpoint, created_at DESC);

-- Índice em open_finance_sync_logs
CREATE INDEX IF NOT EXISTS idx_of_sync_logs_org ON public.open_finance_sync_logs (organization_id, created_at DESC);

-- 2.4 Tabela para cache de background jobs (materialização)
CREATE TABLE IF NOT EXISTS public.materialized_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'cashflow_forecast', 'recurring_expenses', 'financial_health', 'benchmarking'
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  UNIQUE(organization_id, metric_type)
);

ALTER TABLE public.materialized_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics for their organizations"
ON public.materialized_metrics
FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

CREATE INDEX idx_materialized_metrics_org_type ON public.materialized_metrics (organization_id, metric_type);
CREATE INDEX idx_materialized_metrics_expires ON public.materialized_metrics (expires_at);
