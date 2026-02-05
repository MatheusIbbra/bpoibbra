-- =============================================
-- KLAVI OPEN FINANCE INTEGRATION TABLES
-- =============================================

-- 1. OAuth States (para validação do fluxo OAuth)
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  state TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'klavi',
  redirect_path TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para busca rápida por state
CREATE INDEX idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- 2. Bank Connections (conexões bancárias via Open Finance)
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'klavi',
  provider_name TEXT, -- Nome do banco (ex: "Banco do Brasil", "Itaú")
  external_consent_id TEXT,
  external_account_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'error')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes para bank_connections
CREATE INDEX idx_bank_connections_org ON public.bank_connections(organization_id);
CREATE INDEX idx_bank_connections_status ON public.bank_connections(status);
CREATE INDEX idx_bank_connections_provider ON public.bank_connections(provider);
CREATE UNIQUE INDEX idx_bank_connections_consent ON public.bank_connections(external_consent_id) WHERE external_consent_id IS NOT NULL;

-- 3. Integration Logs (observabilidade)
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'klavi',
  event_type TEXT NOT NULL, -- 'oauth_start', 'oauth_callback', 'token_exchange', 'token_refresh', 'sync', 'webhook', 'error'
  status TEXT NOT NULL DEFAULT 'info' CHECK (status IN ('info', 'success', 'warning', 'error')),
  message TEXT,
  payload JSONB DEFAULT '{}',
  error_details TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes para integration_logs
CREATE INDEX idx_integration_logs_org ON public.integration_logs(organization_id);
CREATE INDEX idx_integration_logs_connection ON public.integration_logs(bank_connection_id);
CREATE INDEX idx_integration_logs_event ON public.integration_logs(event_type);
CREATE INDEX idx_integration_logs_created ON public.integration_logs(created_at DESC);

-- 4. Adicionar foreign key em transactions para bank_connection
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE SET NULL;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS external_transaction_id TEXT;

-- Index para idempotência
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_unique 
ON public.transactions(external_transaction_id, bank_connection_id) 
WHERE external_transaction_id IS NOT NULL AND bank_connection_id IS NOT NULL;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- OAuth States: usuário só vê seus próprios states
CREATE POLICY "Users can view own oauth states"
  ON public.oauth_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create oauth states for their org"
  ON public.oauth_states FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

CREATE POLICY "Users can delete own oauth states"
  ON public.oauth_states FOR DELETE
  USING (auth.uid() = user_id);

-- Bank Connections: baseado em organização visualizável
CREATE POLICY "Users can view org bank connections"
  ON public.bank_connections FOR SELECT
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can create bank connections for their org"
  ON public.bank_connections FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

CREATE POLICY "Users can update own org bank connections"
  ON public.bank_connections FOR UPDATE
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

CREATE POLICY "Users can delete own org bank connections"
  ON public.bank_connections FOR DELETE
  USING (organization_id IN (SELECT public.get_viewable_organizations(auth.uid())));

-- Integration Logs: somente leitura para organização
CREATE POLICY "Users can view org integration logs"
  ON public.integration_logs FOR SELECT
  USING (
    organization_id IS NULL 
    OR organization_id IN (SELECT public.get_viewable_organizations(auth.uid()))
  );

-- Service role pode inserir logs (via Edge Functions)
CREATE POLICY "Service role can insert logs"
  ON public.integration_logs FOR INSERT
  WITH CHECK (true);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Função para limpar oauth_states expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.oauth_states
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Trigger para atualizar updated_at em bank_connections
CREATE TRIGGER update_bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();